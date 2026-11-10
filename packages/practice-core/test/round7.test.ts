/**
 * Owner round 7 (docs/plan/2026-11-10-owner-round-7.md): «طبّقها على عادة» writes one coherent answer of the habit's
 * loop (C2), and a «تخفّف» program without a privacy code is not covered (C6).
 */
import { describe, expect, it } from 'vitest';
import {
  anchoredPrayerOf,
  applyStrategyToPlan,
  emptyStore,
  createPlan,
  dayAgenda,
  habitListRows,
  listedStrategies,
  minimumOf,
  setAmountAndMinimum,
  setMinimum,
  startProgram,
  STRATEGIES,
  strategyApplyField,
  strategyAppliesToHabit,
  updatePlan,
  upsertPlan,
  type Plan,
} from '../src/index.js';

const NOW = '2026-11-10T08:00:00.000Z';
const LATER = '2026-11-10T09:00:00.000Z';

function plan(extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id: 'p1', deedSlug: 'quran', title: 'ورد القرآن', unit: 'minutes', amount: 10, activeDaysPerWeek: 7, slots: ['05:30'], createdOn: '2026-10-01' }, NOW),
    ...extra,
  };
}

describe('«طبّقها على عادة» (round 7, C2)', () => {
  it('applies only the strategies that are one answer of a habit loop', () => {
    const applied = STRATEGIES.filter((s) => strategyAppliesToHabit(s.key)).map((s) => [s.key, strategyApplyField(s.key)]);
    expect(applied).toEqual([
      ['start-tiny', 'routine'],
      ['anchor-prayer', 'cue'],
      ['if-then', 'ifThen'],
      ['prepare-place', 'cue'],
      ['make-up', 'ifThen'],
      ['bundle', 'reward'],
    ]);
    // A season, good company and the evening review open their own place; «ترك» strategies never shape a habit.
    for (const key of ['season', 'company', 'self-review', 'never-twice', 'block-sin', 'know-weak', 'ride-wave', 'follow-good']) {
      expect(strategyAppliesToHabit(key), key).toBe(false);
      expect(strategyApplyField(key), key).toBeNull();
    }
    for (const s of listedStrategies('leave')) expect(s.applyField).toBeUndefined();
  });

  it('starts the first loop with the habit as its routine when the habit has none', () => {
    const next = applyStrategyToPlan(plan(), 'anchor-prayer', '  بعد صلاة الفجر مباشرة ', { loopId: 'l1', routine: 'ورد القرآن: 10 دقائق', now: LATER });
    expect(next.loops).toEqual([{ id: 'l1', cue: 'بعد صلاة الفجر مباشرة', craving: '', routine: 'ورد القرآن: 10 دقائق', reward: '', updatedAt: LATER }]);
    expect(next.updatedAt).toBe(LATER);
    const tiny = applyStrategyToPlan(plan(), 'start-tiny', 'دقيقتان فقط', { loopId: 'l1', routine: 'ورد القرآن: 10 دقائق', now: LATER });
    expect(tiny.loops?.[0]?.routine).toBe('دقيقتان فقط');
  });

  it('changes only its own answer of the first loop, never the others', () => {
    const withLoop = applyStrategyToPlan(plan(), 'start-tiny', 'دقيقتان', { loopId: 'l1', routine: 'x', now: NOW });
    const both = applyStrategyToPlan(withLoop, 'make-up', 'إن فاتني يومًا أتممته قبل الظهر', { loopId: 'l2', routine: 'x', now: LATER });
    expect(both.loops).toHaveLength(1);
    expect(both.loops?.[0]).toMatchObject({ id: 'l1', routine: 'دقيقتان', ifThen: 'إن فاتني يومًا أتممته قبل الظهر' });
    expect(() => applyStrategyToPlan(plan(), 'season', 'x', { loopId: 'l1', routine: 'x' })).toThrow(RangeError);
    expect(() => applyStrategyToPlan(plan(), 'bundle', '   ', { loopId: 'l1', routine: 'x' })).toThrow(RangeError);
  });

  it('reads the prayer a habit is tied to', () => {
    expect(anchoredPrayerOf(plan())).toBeNull();
    expect(anchoredPrayerOf({ slotAnchors: [null, 'before-sleep', 'after-isha'] })).toBe('isha');
  });
});

describe('an edit of a habit reaches every view at once (round 7, C5)', () => {
  it('the day list reads the edited amount, minimum and days from the same store', () => {
    let store = upsertPlan(emptyStore(), plan(), NOW);
    store = updatePlan(store, 'p1', (p) => setMinimum({ ...p, amount: 5, title: 'ورد الصباح' }, 2, LATER), LATER);
    const item = dayAgenda(store, '2026-11-10').find((i) => i.kind === 'habit');
    expect(item).toMatchObject({ planId: 'p1', required: 5 });
    expect(minimumOf(store.plans[0] as Plan)).toBe(2);
    expect(habitListRows(store, null)).toEqual([{ kind: 'habit', plan: store.plans[0] }]);
  });
});

describe('«تعديل العادة»: amount and minimum together (round 7, C3/C5)', () => {
  it('lowers the minimum with the amount instead of refusing the edit', () => {
    const p = setMinimum(plan(), 5, NOW);
    const next = setAmountAndMinimum(p, 3, undefined, '2026-11-10', LATER);
    expect(next).toMatchObject({ amount: 3, minimum: 3, amountChangedOn: '2026-11-10' });
  });

  it('sets the chosen minimum, keeps an untouched default unset, and refuses going up', () => {
    expect(setAmountAndMinimum(plan(), 10, 3, '2026-11-10', LATER).minimum).toBe(3);
    expect(setAmountAndMinimum(plan(), 10, minimumOf(plan()), '2026-11-10', LATER)).toEqual(plan());
    expect(setAmountAndMinimum(plan(), 7, undefined, '2026-11-10', LATER)).toMatchObject({ amount: 7 });
    expect(setAmountAndMinimum(plan(), 7, undefined, '2026-11-10', LATER).minimum).toBeUndefined();
    expect(() => setAmountAndMinimum(plan(), 15, undefined, '2026-11-10')).toThrow(RangeError);
  });
});

describe('«تخفّف» without a privacy code (round 7, C6)', () => {
  it('shows the program like any habit when the client says there is nothing to cover', () => {
    const program = startProgram({ sinSlug: 'gheebah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-11-10' });
    const store = emptyStore();
    expect(habitListRows(store, [program])[0]).toMatchObject({ kind: 'lighten', covered: true });
    expect(habitListRows(store, [program], { covered: false })[0]).toMatchObject({ kind: 'lighten', covered: false, locked: false });
  });
});
