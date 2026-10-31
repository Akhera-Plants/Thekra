import { describe, expect, it } from 'vitest';
import {
  agendaGroup,
  createPlan,
  createRelative,
  dayAgenda,
  emptyStore,
  groupAgenda,
  groupToday,
  isPeriodicPlan,
  logContact,
  logDone,
  nextAskedOn,
  offDayItems,
  periodicActs,
  remainingCount,
  upcomingPeriodic,
  upsertPlan,
  upsertRelative,
  type AgendaItem,
  type Plan,
  type Rule,
  type Store,
} from '../src/index.js';

const NOW = '2026-10-28T08:00:00.000Z';
const TODAY = '2026-10-28'; // a Wednesday
const friday: Rule = { kind: 'weekdays', days: [5] };

function plan(id: string, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id, deedSlug: 'x', title: id, unit: 'count', amount: 1, activeDaysPerWeek: 3, slots: ['21:00'], createdOn: '2026-10-01' }, NOW),
    ...extra,
  };
}

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

describe('today grouping', () => {
  it('groups any row model by a classifier, keeping each group in order', () => {
    const rows = ['o1', 'd1', 'x1', 'o2', 'x2', 'd2'];
    const g = groupToday(rows, (r) => (r.startsWith('o') ? 'occasion' : r.startsWith('d') ? 'done' : 'open'));
    expect(g).toEqual({ occasions: ['o1', 'o2'], open: ['x1', 'x2'], done: ['d1', 'd2'] });
  });

  it('groups agenda items: occasions apart, open first, done sunk to the bottom', () => {
    const items: AgendaItem[] = [
      { kind: 'occasion', key: 'fri', titleAr: 'الجمعة', titleEn: 'Friday', deed: 'x' },
      { kind: 'habit', planId: 'a', required: 1, done: 1, remaining: 0, complete: true },
      { kind: 'habit', planId: 'b', required: 1, done: 0, remaining: 1, complete: false },
      { kind: 'relative', relativeId: 'r', done: true, overdueDays: 0 },
      { kind: 'program', done: false },
    ];
    const g = groupAgenda(items);
    expect(g.occasions.map(agendaGroup)).toEqual(['occasion']);
    expect(g.open.map((i) => i.kind)).toEqual(['habit', 'program']);
    expect(g.done.map((i) => i.kind)).toEqual(['habit', 'relative']);
    expect(remainingCount(items)).toBe(2);
  });

  it('counts what is left of a real day; a logged habit is not left', () => {
    const s = storeOf(logDone(plan('a'), TODAY, 1), plan('b'), plan('c'));
    expect(remainingCount(dayAgenda(s, TODAY))).toBe(2);
    expect(remainingCount([])).toBe(0);
  });

  it('gives loggable rows for plans the day does not ask for, with their usual amount', () => {
    const s = storeOf(plan('daily'), logDone(plan('fri', { rule: friday }), TODAY, 1));
    const rows = offDayItems(s, TODAY);
    expect(rows).toEqual([{ kind: 'habit', planId: 'fri', required: 1, done: 1, remaining: 0, complete: true }]);
    expect(offDayItems(s, '2026-10-30')).toEqual([]);
  });
});

describe('periodic acts', () => {
  const defaultRuleOf = (p: Plan): Rule | undefined => (p.habitKey === 'friday-night' ? friday : undefined);

  it('a plan is periodic when its rule (own, else the catalog default) is not every day', () => {
    expect(isPeriodicPlan(plan('daily'))).toBe(false);
    expect(isPeriodicPlan(plan('d2', { rule: { kind: 'daily' } }))).toBe(false);
    expect(isPeriodicPlan(plan('all7', { rule: { kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] } }))).toBe(false);
    expect(isPeriodicPlan(plan('every1', { rule: { kind: 'everyNDays', n: 1, anchor: '2026-10-01' } }))).toBe(false);
    expect(isPeriodicPlan(plan('weekly', { rule: friday }))).toBe(true);
    expect(isPeriodicPlan(plan('cat', { habitKey: 'friday-night' }), { defaultRuleOf })).toBe(true);
    expect(isPeriodicPlan(plan('cat', { habitKey: 'friday-night' }))).toBe(false);
  });

  it('finds the next day a plan asks for', () => {
    expect(nextAskedOn(plan('w', { rule: friday }), TODAY)).toBe('2026-10-30');
    expect(nextAskedOn(plan('w', { rule: friday }), '2026-10-30')).toBe('2026-10-30');
  });

  it('lists relatives and non-daily habits soonest first; a habit done today moves to its next day', () => {
    let s = storeOf(plan('daily'), plan('fri', { rule: friday }), plan('mon', { rule: { kind: 'weekdays', days: [1, 3] } }));
    s = upsertRelative(s, createRelative({ id: 'r1', name: 'خالتي', relation: '', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } }, NOW), NOW);
    s = { ...s, relatives: s.relatives.map((r) => logContact(r, '2026-10-27')) };
    expect(periodicActs(s, TODAY).map((a) => `${a.kind}:${a.id}:${a.next}`)).toEqual([
      'habit:mon:2026-10-28',
      'habit:fri:2026-10-30',
      'relative:r1:2026-11-03',
    ]);
    const done = { ...s, plans: s.plans.map((p) => (p.id === 'mon' ? logDone(p, TODAY, 1) : p)) };
    expect(periodicActs(done, TODAY).find((a) => a.id === 'mon')?.next).toBe('2026-11-02');
  });

  it('shows at most three acts still ahead', () => {
    const rows = [
      { act: { kind: 'relative' as const, id: 'late', next: '2026-10-20' } },
      { act: { kind: 'habit' as const, id: 'now', next: TODAY } },
      { act: { kind: 'habit' as const, id: 'a', next: '2026-10-29' } },
      { act: { kind: 'habit' as const, id: 'b', next: '2026-10-30' } },
      { act: { kind: 'habit' as const, id: 'never', next: null } },
      { act: { kind: 'relative' as const, id: 'c', next: '2026-11-01' } },
    ];
    expect(upcomingPeriodic(rows, TODAY).map((r) => r.act.id)).toEqual(['a', 'b', 'c']);
  });
});
