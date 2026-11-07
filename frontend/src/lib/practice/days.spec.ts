import { describe, expect, it } from 'vitest';
import { createPlan } from '@thekra/practice-core';
import { planWeekdays, sameWeekdays, withWeekdays } from './days';

const plan = createPlan({
  id: '11111111-1111-4111-8111-111111111111',
  deedSlug: 'quran',
  title: 'ورد',
  unit: 'minutes',
  amount: 5,
  activeDaysPerWeek: 3,
  slots: ['06:00'],
  createdOn: '2026-11-01',
});

describe('habit days (A-13 a)', () => {
  it('reads every day without a rule, and a weekday rule as its days', () => {
    expect(planWeekdays(plan)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(planWeekdays(plan, { kind: 'weekdays', days: [4, 1] })).toEqual([1, 4]);
    expect(planWeekdays(plan, { kind: 'hijriMonthDays', days: [13] })).toBeNull();
  });

  it('stores picked days as the rule and counts them', () => {
    const next = withWeekdays(plan, [5, 1, 3, 1], '2026-11-07T10:00:00.000Z');
    expect(next.rule).toEqual({ kind: 'weekdays', days: [1, 3, 5] });
    expect(next.activeDaysPerWeek).toBe(3);
    expect(sameWeekdays(next, [3, 5, 1])).toBe(true);
  });

  it('drops the rule for all seven days and refuses none', () => {
    const next = withWeekdays({ ...plan, rule: { kind: 'weekdays', days: [1] } }, [0, 1, 2, 3, 4, 5, 6]);
    expect(next.rule).toBeUndefined();
    expect(next.activeDaysPerWeek).toBe(7);
    expect(() => withWeekdays(plan, [])).toThrow(RangeError);
  });
});
