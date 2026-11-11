/**
 * Suitable times only (owner, 2026-11-01): the anchors and fixed times offered for a deed follow its window on the
 * day's prayer times (sunrise from AlAdhan when cached), and a plan's unsuitable slots are found and fixed.
 */

import type { DeedWindow, PrayerCache, PrayerSettings } from '@thekra/practice-core';
import { emptyOffsets, prayerCacheKey } from '@thekra/practice-core';
import {
  fixedChoices,
  isChoiceSuitable,
  offeredAnchors,
  pickerStart,
  startingSlots,
  suitableDefaults,
  unsuitableChoices,
  windowRange,
} from '../lib/practice/deed-window';
import { parseSunrise, prayerDayOn, sunriseMissing, withSunrise } from '../lib/practice/prayer-day';

const DUHA: DeedWindow = { from: 'sunrise', to: 'dhuhr', fromMinutes: 15, toMinutes: -10, anchors: [] };
const WITR: DeedWindow = { from: 'isha', to: 'fajr', fromMinutes: 20, toMinutes: -10, anchors: ['after-isha', 'before-sleep'] };
const TIMES = { fajr: '05:00', sunrise: '06:20', dhuhr: '11:40', asr: '14:50', maghrib: '17:10', isha: '18:30' };

describe('deed windows in the slot editors', () => {
  it('offers no prayer anchor for Duha, and witr only its two', () => {
    expect(offeredAnchors(DUHA)).toEqual([]);
    expect(offeredAnchors(WITR)).toEqual(['after-isha', 'before-sleep']);
    expect(offeredAnchors(undefined)).toHaveLength(6);
  });

  it('finds «بعد الظهر» and a noon time unsuitable for Duha, a morning time fine', () => {
    expect(isChoiceSuitable('after-dhuhr', DUHA, TIMES)).toBe(false);
    expect(isChoiceSuitable('12:30', DUHA, TIMES)).toBe(false);
    expect(isChoiceSuitable('09:30', DUHA, TIMES)).toBe(true);
    expect(unsuitableChoices(['after-dhuhr', '09:30', '12:30'], DUHA, TIMES)).toEqual(['after-dhuhr', '12:30']);
    expect(unsuitableChoices(['after-dhuhr', '03:00'], undefined, TIMES)).toEqual([]);
  });

  it('keeps the suitable defaults, else falls back to the start of the window', () => {
    expect(suitableDefaults(['09:30', '11:00'], DUHA, TIMES)).toEqual(['09:30', '11:00']);
    expect(suitableDefaults(['13:00'], DUHA, TIMES)).toEqual(['06:35']);
    expect(suitableDefaults(['13:00'], undefined, TIMES)).toEqual(['13:00']);
  });

  it('never starts a new habit with no time (the add screen builds a plan from it on its first render)', () => {
    expect(startingSlots([], undefined, TIMES)).toEqual(['09:00']);
    expect(startingSlots(['13:00'], DUHA, TIMES)).toEqual(['06:35']);
    expect(startingSlots(['09:30'], undefined, TIMES)).toEqual(['09:30']);
  });

  it('fixes a plan: drops what does not suit, or puts the suitable defaults back', () => {
    expect(fixedChoices(['after-dhuhr', '09:30'], ['09:30', '11:00'], DUHA, TIMES)).toEqual(['09:30']);
    expect(fixedChoices(['after-dhuhr', 'after-asr'], ['09:30', '11:00'], DUHA, TIMES)).toEqual(['09:30', '11:00']);
  });

  it('opens the time picker inside the window', () => {
    expect(pickerStart([], DUHA, TIMES, '15:00')).toBe('06:35');
    expect(pickerStart([], DUHA, TIMES, '10:00')).toBe('10:00');
    expect(pickerStart(['09:30'], DUHA, TIMES, '15:00')).toBe('09:30');
    expect(pickerStart(['13:00'], undefined, TIMES, '15:00')).toBe('13:00');
  });

  it('gives the window line its two ends (witr crosses midnight)', () => {
    expect(windowRange(DUHA, TIMES)).toEqual({ from: '06:35', to: '11:30' });
    expect(windowRange(WITR, TIMES)).toEqual({ from: '18:50', to: '04:50' });
    expect(windowRange(undefined, TIMES)).toBeNull();
  });
});

describe('sunrise in the cached prayer day', () => {
  const json = {
    data: [
      { timings: { Fajr: '05:01 (+03)', Sunrise: '06:22 (+03)', Dhuhr: '11:41', Asr: '14:51', Maghrib: '17:11', Isha: '18:31' }, date: { gregorian: { date: '01-11-2026' } } },
      { timings: { Fajr: '05:02', Dhuhr: '11:41', Asr: '14:50', Maghrib: '17:10', Isha: '18:30' }, date: { gregorian: { date: '02-11-2026' } } },
    ],
  };
  const settings: PrayerSettings = { city: 'Riyadh', country: 'SA', method: 4, offsets: { ...emptyOffsets(), fajr: 5 } };

  it('reads AlAdhan’s sunrise per day and adds it to the fetched days', () => {
    expect(parseSunrise(json)).toEqual({ '2026-11-01': '06:22' });
    expect(parseSunrise(null)).toEqual({});
    const days = withSunrise(
      {
        '2026-11-01': { fajr: '05:01', dhuhr: '11:41', asr: '14:51', maghrib: '17:11', isha: '18:31' },
        '2026-11-02': { fajr: '05:02', dhuhr: '11:41', asr: '14:50', maghrib: '17:10', isha: '18:30' },
      },
      parseSunrise(json),
    );
    expect(days['2026-11-01']!.sunrise).toBe('06:22');
    expect(days['2026-11-02']!.sunrise).toBeUndefined();
  });

  it('gives the day with the prayer offsets and the raw sunrise; knows when sunrise is missing', () => {
    const cache: PrayerCache = {
      key: prayerCacheKey(settings),
      days: {
        '2026-11-01': { fajr: '05:01', dhuhr: '11:41', asr: '14:51', maghrib: '17:11', isha: '18:31', sunrise: '06:22' } as never,
        '2026-11-02': { fajr: '05:02', dhuhr: '11:41', asr: '14:50', maghrib: '17:10', isha: '18:30' },
      },
    };
    expect(prayerDayOn(cache, settings, '2026-11-01')).toEqual({ fajr: '05:06', dhuhr: '11:41', asr: '14:51', maghrib: '17:11', isha: '18:31', sunrise: '06:22' });
    expect(prayerDayOn(cache, settings, '2026-11-02')?.sunrise).toBeUndefined();
    expect(prayerDayOn(cache, null, '2026-11-01')).toBeUndefined();
    expect(sunriseMissing(cache, '2026-11-01')).toBe(false);
    expect(sunriseMissing(cache, '2026-11-02')).toBe(true);
    expect(sunriseMissing(cache, '2026-12-30')).toBe(false);
  });
});
