import { describe, expect, it } from 'vitest';
import {
  checkIn,
  createPlan,
  createRelative,
  emptyStore,
  logContact,
  logDone,
  startProgram,
  upsertPlan,
  upsertRelative,
  type Plan,
  type Rule,
  type Store,
} from '@thekra/practice-core';
import { periodicHref, wirdDay, wirdSummary } from './wird';

const T = '2026-10-28T10:00:00.000Z';
const TODAY = '2026-10-28'; // a Wednesday
const friday: Rule = { kind: 'weekdays', days: [5] };

const plan = (id: string, extra: Partial<Plan> = {}): Plan => ({
  ...createPlan({ id, deedSlug: 'duha', title: id, unit: 'count', amount: 1, activeDaysPerWeek: 4, slots: ['09:30'], createdOn: '2026-10-20' }, T),
  ...extra,
});

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, T), emptyStore());
}

describe('wirdDay', () => {
  it('lists open tasks first, done ones after, and off-day habits apart', () => {
    let s = storeOf(logDone(plan('a'), TODAY, 1), plan('b'), plan('fri', { rule: friday }));
    s = upsertRelative(s, createRelative({ id: 'r1', name: 'خالتي', relation: '', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } }, T), T);
    const day = wirdDay(s, TODAY);
    expect(day.open.map((i) => (i.kind === 'habit' ? i.planId : i.kind))).toEqual(['b', 'relative']);
    expect(day.done.map((i) => (i.kind === 'habit' ? i.planId : i.kind))).toEqual(['a']);
    expect(day.offDay.map((i) => i.planId)).toEqual(['fri']);
    expect(day.occasions).toEqual([]);
  });

  it('puts today\'s occasion on its own line and keeps the private check-in generic', () => {
    const program = startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-20' }, T);
    const s: Store = { ...storeOf(), programs: [checkIn(program, TODAY, 'held', undefined, T)] };
    const day = wirdDay(s, TODAY, {
      occasions: [{ key: 'wed', titleAr: 'الأربعاء', titleEn: 'Wednesday', deed: 'siyam', rule: { kind: 'weekdays', days: [3] } }],
    });
    expect(day.occasions.map((o) => o.key)).toEqual(['wed']);
    expect(day.done).toEqual([{ kind: 'program', done: true }]);
    expect(JSON.stringify(day)).not.toContain('ghibah');
  });
});

describe('wirdSummary', () => {
  it('counts what is left today and the streak', () => {
    const a = ['2026-10-26', '2026-10-27'].reduce((p, d) => logDone(p, d, 1), plan('a'));
    const s = storeOf(a, plan('b', { createdOn: TODAY }));
    expect(wirdSummary(s, TODAY)).toEqual({ remaining: 2, streak: 2, longest: 2, hasPlans: true });
    const done = { ...s, plans: s.plans.map((p) => logDone(p, TODAY, 1)) };
    expect(wirdSummary(done, TODAY)).toMatchObject({ remaining: 0, streak: 3 });
  });

  it('is empty without plans; a relative alone is left but has no streak', () => {
    expect(wirdSummary(emptyStore(), TODAY)).toEqual({ remaining: 0, streak: 0, longest: 0, hasPlans: false });
    let s = upsertRelative(emptyStore(), createRelative({ id: 'r', name: 'خالي', relation: '', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } }, T), T);
    expect(wirdSummary(s, TODAY)).toMatchObject({ remaining: 1, hasPlans: false });
    s = { ...s, relatives: s.relatives.map((r) => logContact(r, TODAY)) };
    expect(wirdSummary(s, TODAY).remaining).toBe(0);
  });
});

describe('periodicHref', () => {
  it('opens a relative on the kinship page and a habit on its plan', () => {
    expect(periodicHref({ kind: 'relative', id: 'r1', next: TODAY })).toBe('/practice/kinship');
    expect(periodicHref({ kind: 'habit', id: 'p1', next: null })).toBe('/practice/habits#plan-p1');
  });
});
