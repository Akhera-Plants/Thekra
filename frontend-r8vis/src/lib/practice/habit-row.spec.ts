import { describe, expect, it } from 'vitest';
import { addDays, startSeason, toHijri } from '@thekra/practice-core';
import type { PracticeHabit } from '@/lib/types/practice';
import { editPlan, planAction, planFromHabit, ramadanEnd, ramadanSeasonOffer } from './plans';

const habit: PracticeHabit = {
  key: 'quran-wird',
  titleAr: 'ورد القرآن',
  titleEn: 'Daily Quran reading',
  deed: 'quran',
  unit: 'minutes',
  unitLabelAr: 'دقيقة',
  unitLabelEn: 'minutes',
  start: { far: 2, near: 10 },
  defaultRule: { kind: 'daily' },
  defaultSlots: ['06:00', '21:00'],
  basis: 'organizational',
  evidence: ['q1'],
};
const make = () => planFromHabit(habit, { distance: 'near', slots: ['06:00', '21:00'], activeDaysPerWeek: 3 }, '2026-09-01');

describe('the action at the end of a habit row', () => {
  it('logs when asked today, quietly on other days, shows «تمّ» once done and «استأنف» while paused', () => {
    expect(planAction({ isDueToday: true, isComplete: false, done: 0 }, false)).toBe('log');
    expect(planAction({ isDueToday: false, isComplete: false, done: 0 }, false)).toBe('logQuiet');
    expect(planAction({ isDueToday: true, isComplete: true, done: 10 }, false)).toBe('done');
    expect(planAction({ isDueToday: false, isComplete: true, done: 3 }, false)).toBe('done');
    expect(planAction({ isDueToday: true, isComplete: true, done: 10 }, true)).toBe('resume');
    // Nothing logged is never «تمّ», even when nothing is required.
    expect(planAction({ isDueToday: true, isComplete: true, done: 0 }, false)).toBe('log');
  });
});

describe('«وضع رمضان» is offered only in Ramadan', () => {
  it('offers nothing on any day outside Ramadan, whatever the Hijri offset', () => {
    const plan = make();
    let checked = 0;
    for (let i = 0; i < 400; i += 3) {
      const day = addDays('2026-01-01', i);
      for (const offset of [-2, -1, 0, 1, 2]) {
        if (toHijri(day, offset).month === 9) continue;
        expect(ramadanEnd(day, offset)).toBeNull();
        expect(ramadanSeasonOffer(plan, day, offset)).toBeNull();
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('offers the next step until the last day of Ramadan, once', () => {
    const plan = make();
    const offer = ramadanSeasonOffer(plan, '2026-03-01', 0);
    expect(offer?.amount).toBeGreaterThan(10);
    expect(offer?.until === '2026-03-18' || offer?.until === '2026-03-19').toBe(true);
    const inSeason = startSeason(plan, offer!.amount, offer!.until);
    expect(ramadanSeasonOffer(inSeason, '2026-03-02', 0)).toBeNull();
    // A habit at its ceiling has no higher step to offer.
    expect(ramadanSeasonOffer({ ...plan, ceiling: 10 }, '2026-03-01', 0)).toBeNull();
  });
});

describe('editing the times of a habit', () => {
  const now = '2026-10-28T10:00:00.000Z';

  it('keeps prayer anchors chosen in the edit form', () => {
    const edited = editPlan(make(), { slots: ['after-isha', '06:00'], activeDaysPerWeek: 3, amount: 10 }, '2026-10-28', now);
    expect(edited.slotAnchors).toEqual([null, 'after-isha']);
    expect(edited.slots[0]).toBe('06:00');
  });

  it('leaves the plan alone when the same anchors come back, and drops anchors for plain times', () => {
    const anchored = editPlan(make(), { slots: ['after-fajr'], activeDaysPerWeek: 3, amount: 10 }, '2026-10-28', now);
    expect(editPlan(anchored, { slots: ['after-fajr'], activeDaysPerWeek: 3, amount: 10 }, '2026-10-28', now)).toBe(anchored);
    const plain = editPlan(anchored, { slots: ['07:00'], activeDaysPerWeek: 3, amount: 10 }, '2026-10-28', now);
    expect(plain.slots).toEqual(['07:00']);
    expect(plain.slotAnchors).toBeUndefined();
  });
});
