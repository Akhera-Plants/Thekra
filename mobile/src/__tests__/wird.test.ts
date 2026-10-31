/**
 * «ورد اليوم» today list and «أعمال دورية» (pure helpers in wird.ts), and the streak shown in the header and in
 * «سجلّي» (practice-core `currentStreak` / `longestStreak`, with the catalog default rules the app passes).
 * - Today's rows: occasions apart (one compact line), open tasks first, done ones sunk to the bottom, order kept.
 * - Periodic acts: relatives and habits whose rule is not daily, soonest first; the daily screen shows what is ahead.
 */

import {
  createPlan,
  createRelative,
  currentStreak,
  dayAgenda,
  emptyStore,
  logContact,
  logDone,
  longestStreak,
  upsertPlan,
  upsertRelative,
  type HabitItem,
  type Plan,
  type RelativeItem,
  type Rule,
  type Store,
} from '@thekra/practice-core';
import {
  groupTodayRows,
  isPeriodicPlan,
  isRowDone,
  nextAskedOn,
  periodicActs,
  upcomingPeriodic,
  type AgendaRowModel,
} from '../lib/practice/wird';

const NOW = '2026-10-28T08:00:00.000Z';
const TODAY = '2026-10-28'; // a Wednesday

const habitItem = (planId: string, complete: boolean): HabitItem => ({
  kind: 'habit',
  planId,
  required: 2,
  done: complete ? 2 : 0,
  remaining: complete ? 0 : 2,
  complete,
});
const relItem = (relativeId: string, done: boolean): RelativeItem => ({ kind: 'relative', relativeId, done, overdueDays: 0 });

const habitRow = (id: string, complete: boolean): AgendaRowModel => ({ key: `h-${id}`, kind: 'habit', item: habitItem(id, complete), title: id, meta: '' });
const relRow = (id: string, done: boolean): AgendaRowModel => ({ key: `r-${id}`, kind: 'relative', item: relItem(id, done), title: id, relation: '', meta: '' });

function plan(id: string, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id, deedSlug: 'x', title: id, unit: 'count', amount: 1, activeDaysPerWeek: 3, slots: ['21:00'], createdOn: '2026-10-01' }, NOW),
    ...extra,
  };
}

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

describe('today list grouping', () => {
  it('puts occasions apart, open tasks first and done ones at the bottom, keeping their order', () => {
    const rows: AgendaRowModel[] = [
      { key: 'o-fri', kind: 'occasion', title: 'الجمعة', deed: 'x' },
      habitRow('a', true),
      habitRow('b', false),
      relRow('r1', false),
      relRow('r2', true),
      { key: 'program', kind: 'program', done: false, meta: '' },
      habitRow('c', true),
    ];
    const g = groupTodayRows(rows);
    expect(g.occasions.map((r) => r.key)).toEqual(['o-fri']);
    expect(g.open.map((r) => r.key)).toEqual(['h-b', 'r-r1', 'program']);
    expect(g.done.map((r) => r.key)).toEqual(['h-a', 'r-r2', 'h-c']);
  });

  it('knows when a row is done; an occasion never is', () => {
    expect(isRowDone(habitRow('a', true))).toBe(true);
    expect(isRowDone(relRow('r', false))).toBe(false);
    expect(isRowDone({ key: 'program', kind: 'program', done: true, meta: '' })).toBe(true);
    expect(isRowDone({ key: 'o', kind: 'occasion', title: '', deed: '' })).toBe(false);
  });

  it('groups a real day: a habit logged today sinks below the open one', () => {
    const s = storeOf(logDone(plan('a'), TODAY, 1), plan('b'));
    const rows = dayAgenda(s, TODAY).flatMap((i): AgendaRowModel[] =>
      i.kind === 'habit' ? [{ key: `h-${i.planId}`, kind: 'habit', item: i, title: i.planId, meta: '' }] : [],
    );
    const g = groupTodayRows(rows);
    expect(g.open.map((r) => r.key)).toEqual(['h-b']);
    expect(g.done.map((r) => r.key)).toEqual(['h-a']);
  });
});

describe('periodic acts', () => {
  const friday: Rule = { kind: 'weekdays', days: [5] };
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
    const acts = periodicActs(s, TODAY);
    expect(acts.map((a) => `${a.kind}:${a.id}:${a.next}`)).toEqual([
      'habit:mon:2026-10-28', // Wednesday is one of its days and it is not done yet
      'habit:fri:2026-10-30',
      'relative:r1:2026-11-03',
    ]);
    const done = { ...s, plans: s.plans.map((p) => (p.id === 'mon' ? logDone(p, TODAY, 1) : p)) };
    expect(periodicActs(done, TODAY).find((a) => a.id === 'mon')?.next).toBe('2026-11-02');
  });

  it('the daily screen shows at most three acts still ahead', () => {
    const rows = [
      { act: { kind: 'relative' as const, id: 'late', next: '2026-10-20' } },
      { act: { kind: 'habit' as const, id: 'now', next: TODAY } },
      { act: { kind: 'habit' as const, id: 'a', next: '2026-10-29' } },
      { act: { kind: 'habit' as const, id: 'b', next: '2026-10-30' } },
      { act: { kind: 'habit' as const, id: 'never', next: null } },
      { act: { kind: 'relative' as const, id: 'c', next: '2026-11-01' } },
      { act: { kind: 'relative' as const, id: 'd', next: '2026-11-02' } },
    ];
    expect(upcomingPeriodic(rows, TODAY).map((r) => r.act.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('streak with the app’s plan days', () => {
  it('skips days a catalog rule does not ask for, and today counts only once complete', () => {
    const monThu: Rule = { kind: 'weekdays', days: [1, 4] };
    const defaultRuleOf = (p: Plan): Rule | undefined => (p.habitKey === 'fast-mon-thu' ? monThu : undefined);
    // Mon 19, Thu 22, Mon 26 logged; Thursday 29 is today and not logged yet.
    const fast = ['2026-10-19', '2026-10-22', '2026-10-26'].reduce((p, d) => logDone(p, d, 1), plan('fast', { habitKey: 'fast-mon-thu' }));
    const s = storeOf(fast);
    expect(currentStreak(s, '2026-10-29', { defaultRuleOf })).toBe(3);
    expect(currentStreak(s, '2026-10-29')).toBe(0); // read as daily, yesterday was missed
    expect(longestStreak(s, '2026-10-29', { defaultRuleOf })).toBe(3);
    expect(currentStreak(storeOf(logDone(fast, '2026-10-29', 1)), '2026-10-29', { defaultRuleOf })).toBe(4);
  });
});
