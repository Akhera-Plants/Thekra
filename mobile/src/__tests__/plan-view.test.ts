/**
 * The «صحّح السجل» stepper: minutes by 5 (by 1 under 5), counts by 1, inside 0..max.
 */

import type { CatalogHabit } from '../lib/practice/catalog-types';
import { activeDaysFrom } from '../lib/practice/habits-view';
import { fixLogStep, planFromHabit } from '../lib/practice/plan-view';

describe('fixLogStep', () => {
  it('steps minutes by 5 from 5 up, by 1 below', () => {
    expect(fixLogStep(0, 'minutes', 1, 1000)).toBe(1);
    expect(fixLogStep(4, 'minutes', 1, 1000)).toBe(5);
    expect(fixLogStep(5, 'minutes', 1, 1000)).toBe(10);
    expect(fixLogStep(7, 'minutes', 1, 1000)).toBe(10);
    expect(fixLogStep(10, 'minutes', -1, 1000)).toBe(5);
    expect(fixLogStep(7, 'minutes', -1, 1000)).toBe(5);
    expect(fixLogStep(5, 'minutes', -1, 1000)).toBe(4);
    expect(fixLogStep(1, 'minutes', -1, 1000)).toBe(0);
  });

  it('steps counts and times by 1', () => {
    expect(fixLogStep(5, 'count', 1, 1000)).toBe(6);
    expect(fixLogStep(5, 'times', -1, 1000)).toBe(4);
  });

  it('stays inside 0..max', () => {
    expect(fixLogStep(0, 'count', -1, 1000)).toBe(0);
    expect(fixLogStep(998, 'minutes', 1, 1000)).toBe(1000);
  });
});

describe('a habit on one weekday (QA round 5)', () => {
  it('builds a valid plan for «قيام ليلة الجمعة» (one day picked) instead of throwing «Invalid plan»', () => {
    const habit = {
      key: 'qiyam',
      titleAr: 'قيام الليل',
      titleEn: 'Night prayer',
      deed: 'qiyam',
      unit: 'times',
      unitLabelAr: 'ركعة',
      unitLabelEn: 'rak‘ah',
      start: { far: 2, near: 2 },
      defaultRule: { kind: 'weekdays', days: [5] },
      defaultSlots: ['04:00'],
      basis: 'text',
      evidence: [],
    } as unknown as CatalogHabit;
    const make = () =>
      planFromHabit({ id: 'p', habit, amount: 2, slots: ['04:00'], activeDaysPerWeek: activeDaysFrom([5], 3), rule: habit.defaultRule, today: '2026-11-07', locale: 'ar' });
    expect(make).not.toThrow();
    expect(make().rule).toEqual({ kind: 'weekdays', days: [5] });
  });
});
