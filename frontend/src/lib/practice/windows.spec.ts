import { describe, expect, it } from 'vitest';
import { emptyStore, type DeedWindow, type PrayerTimesWithSunrise } from '@thekra/practice-core';
import type { PracticeHabit } from '@/lib/types/practice';
import { planFromHabit } from './plans';
import { fixPlanSlots, hasUnsuitableSlot, slotProblem, suitableAnchors, suitableChoices, sunrisesFromAlAdhan, windowParts } from './windows';

const duhaWindow: DeedWindow = { from: 'sunrise', fromMinutes: 15, to: 'dhuhr', toMinutes: -10, anchors: [] };
const witrWindow: DeedWindow = { from: 'isha', fromMinutes: 20, to: 'fajr', toMinutes: -10, anchors: ['after-isha', 'before-sleep'] };
const times: PrayerTimesWithSunrise = { fajr: '04:40', sunrise: '06:00', dhuhr: '11:45', asr: '14:55', maghrib: '17:20', isha: '18:50' };

const duha: PracticeHabit = {
  key: 'duha',
  titleAr: 'صلاة الضحى',
  titleEn: 'Duha prayer',
  deed: 'duha',
  unit: 'times',
  unitLabelAr: 'ركعتان',
  unitLabelEn: 'two rakʿahs',
  start: { far: 1, near: 1 },
  defaultRule: { kind: 'daily' },
  defaultSlots: ['09:30', '11:00'],
  window: duhaWindow,
  basis: 'text',
  evidence: [],
};

describe('deed windows on the web', () => {
  it('says each end as after / before / at its edge', () => {
    expect(windowParts(duhaWindow)).toEqual({ from: { edge: 'sunrise', side: 'after' }, to: { edge: 'dhuhr', side: 'before' } });
    expect(windowParts({ from: 'fajr', to: 'maghrib', anchors: [] }).from.side).toBe('at');
  });

  it('offers only the anchors the deed allows (all of them without a window)', () => {
    expect(suitableAnchors(duha)).toEqual([]);
    expect(suitableAnchors({ ...duha, window: witrWindow })).toEqual(['after-isha', 'before-sleep']);
    expect(suitableAnchors({ ...duha, window: undefined })).toHaveLength(6);
  });

  it('refuses «بعد الظهر» and an afternoon time for Duha, and accepts a morning time', () => {
    expect(slotProblem('after-dhuhr', duhaWindow, times)).toBe('anchor');
    expect(slotProblem('13:00', duhaWindow, times)).toBe('outside');
    expect(slotProblem('06:05', duhaWindow, times)).toBe('outside');
    expect(slotProblem('09:30', duhaWindow, times)).toBeNull();
    expect(slotProblem('', duhaWindow, times)).toBeNull();
    expect(slotProblem('13:00', undefined, times)).toBeNull();
  });

  it('accepts a witr time after midnight (the window crosses it)', () => {
    expect(slotProblem('01:30', witrWindow, times)).toBeNull();
    expect(slotProblem('12:00', witrWindow, times)).toBe('outside');
  });

  it('finds an unsuitable slot of an older plan and fixes it with the suggested times', () => {
    const plan = planFromHabit({ ...duha, window: undefined }, { distance: 'far', slots: ['after-dhuhr', '10:00'], activeDaysPerWeek: 3 }, '2026-10-01', 'p1');
    expect(hasUnsuitableSlot(plan, duhaWindow, times)).toBe(true);
    const choices = suitableChoices(plan, duha, times);
    expect(choices).toEqual(['10:00', '09:30']);
    const store = fixPlanSlots({ ...emptyStore(), plans: [plan] }, 'p1', choices!, '2026-11-01T08:00:00.000Z');
    const fixed = store.plans[0]!;
    expect(fixed.slots).toEqual(['09:30', '10:00']);
    expect(fixed.slotAnchors).toBeUndefined();
    expect(hasUnsuitableSlot(fixed, duhaWindow, times)).toBe(false);
    expect(suitableChoices(fixed, duha, times)).toBeNull();
  });

  it('reads sunrise from an AlAdhan month', () => {
    const json = {
      data: [
        { timings: { Fajr: '04:40 (+03)', Sunrise: '06:01 (+03)' }, date: { gregorian: { date: '01-11-2026' } } },
        { timings: { Fajr: '04:41 (+03)' }, date: { gregorian: { date: '02-11-2026' } } },
        { timings: { Sunrise: 'bad' }, date: { gregorian: { date: '03-11-2026' } } },
      ],
    };
    expect(sunrisesFromAlAdhan(json)).toEqual({ '2026-11-01': '06:01' });
    expect(sunrisesFromAlAdhan(null)).toEqual({});
  });
});
