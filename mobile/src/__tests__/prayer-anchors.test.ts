/**
 * «بعد الفجر» reminders: prayer times on the device (adhan, fixed coordinates and date, both default methods),
 * anchored slots in the reminder planner, the stored fallback slot, and the prefs that keep the place.
 * Instants are compared in UTC so the test does not depend on the machine's zone; device-clock times are
 * compared with the same instant read on the device clock.
 */

import { createPlan, emptyStore, type Plan } from '@thekra/practice-core';
import { nowTime } from '../lib/practice/format';
import { DEFAULT_PREFS, parsePrefs } from '../lib/practice/prefs';
import {
  anchorSlot,
  anchorTimeOn,
  defaultMethodFor,
  effectiveMethod,
  prayerClock,
  prayerContext,
  prayerInstant,
  type PrayerContext,
} from '../lib/practice/prayer-times';
import { planReminders, slotTimesOn, type ReminderTexts } from '../lib/practice/reminders';

const MAKKAH = { latitude: 21.42, longitude: 39.83 };
const DAY = '2026-10-29';
const UQ: PrayerContext = { place: MAKKAH, method: 'umm_al_qura' };
const MWL: PrayerContext = { place: MAKKAH, method: 'mwl' };

const iso = (d: Date) => d.toISOString();
const clockOf = (instant: string, plusMinutes = 0) => nowTime(new Date(Date.parse(instant) + plusMinutes * 60_000));

describe('prayer times (adhan 4.4.6)', () => {
  it('computes Makkah on 2026-10-29 with Umm al-Qura (Isha = Maghrib + 90 minutes)', () => {
    expect(iso(prayerInstant('fajr', DAY, UQ))).toBe('2026-10-29T02:05:00.000Z');
    expect(iso(prayerInstant('dhuhr', DAY, UQ))).toBe('2026-10-29T09:04:00.000Z');
    expect(iso(prayerInstant('asr', DAY, UQ))).toBe('2026-10-29T12:20:00.000Z');
    expect(iso(prayerInstant('maghrib', DAY, UQ))).toBe('2026-10-29T14:46:00.000Z');
    expect(iso(prayerInstant('isha', DAY, UQ))).toBe('2026-10-29T16:16:00.000Z');
  });

  it('computes the same day with the Muslim World League (Fajr 18°, Isha 17°)', () => {
    expect(iso(prayerInstant('fajr', DAY, MWL))).toBe('2026-10-29T02:07:00.000Z');
    expect(iso(prayerInstant('maghrib', DAY, MWL))).toBe('2026-10-29T14:46:00.000Z');
    expect(iso(prayerInstant('isha', DAY, MWL))).toBe('2026-10-29T15:57:00.000Z');
  });

  it('gives the five times on the device clock', () => {
    expect(prayerClock(DAY, UQ)).toEqual({
      fajr: clockOf('2026-10-29T02:05:00.000Z'),
      dhuhr: clockOf('2026-10-29T09:04:00.000Z'),
      asr: clockOf('2026-10-29T12:20:00.000Z'),
      maghrib: clockOf('2026-10-29T14:46:00.000Z'),
      isha: clockOf('2026-10-29T16:16:00.000Z'),
    });
  });

  it('adds the offset to the prayer time', () => {
    expect(anchorTimeOn({ prayer: 'fajr', offset: 10 }, DAY, UQ)).toBe(clockOf('2026-10-29T02:05:00.000Z', 10));
    expect(anchorTimeOn({ prayer: 'isha', offset: 60 }, DAY, MWL)).toBe(clockOf('2026-10-29T15:57:00.000Z', 60));
  });

  it('picks the default method by region: Umm al-Qura in Saudi Arabia, MWL where adhan has no local one', () => {
    expect(defaultMethodFor('SA')).toBe('umm_al_qura');
    expect(defaultMethodFor('sa')).toBe('umm_al_qura');
    expect(defaultMethodFor('JO')).toBe('mwl');
    expect(defaultMethodFor(null)).toBe('mwl');
    // A chosen city's country wins over the device region; the user's choice wins over both.
    const riyadh = { ...MAKKAH, source: 'city' as const, city: 'riyadh' };
    expect(effectiveMethod(riyadh, null, 'GB')).toBe('umm_al_qura');
    expect(effectiveMethod(riyadh, 'mwl', 'SA')).toBe('mwl');
    expect(prayerContext(null, null, 'SA')).toBeNull();
  });
});

describe('anchored slots', () => {
  function plan(overrides: Partial<Plan> = {}): Plan {
    return createPlan({
      id: '0b9b0c1e-0000-4000-8000-000000000001',
      habitKey: 'adhkar-sabah-masa',
      deedSlug: 'dhikr',
      title: 'أذكار',
      unit: 'count',
      amount: 10,
      activeDaysPerWeek: 3,
      slots: ['05:15', '21:00'],
      anchors: [{ slot: '05:15', prayer: 'fajr', offset: 10 }],
      createdOn: '2026-10-01',
      ...overrides,
    });
  }

  it('resolves an anchored slot to that day’s prayer time; clock slots stay; no place keeps the stored time', () => {
    const fajr10 = clockOf('2026-10-29T02:05:00.000Z', 10);
    expect(slotTimesOn(plan(), DAY, UQ)).toEqual([fajr10, '21:00'].sort());
    expect(slotTimesOn(plan(), DAY, null)).toEqual(['05:15', '21:00']);
    expect(slotTimesOn(plan({ anchors: undefined }), DAY, UQ)).toEqual(['05:15', '21:00']);
  });

  it('plans reminders that follow the prayer from day to day', () => {
    const texts: ReminderTexts = {
      habitBody: (a) => a,
      habitLogged: 'سُجِّل لهذا اليوم.',
      kinshipTitle: '',
      kinshipBodyGeneric: () => '',
      kinshipBodyNames: () => '',
      sinBody: '',
      unitFallback: { minutes: 'دقيقة', count: 'مرة', times: 'مرة' },
      listSeparator: '، ',
    };
    const list = planReminders({
      store: { ...emptyStore(), plans: [plan({ slots: ['05:15'] })] },
      prefs: { ...DEFAULT_PREFS, habitReminders: true },
      habits: [],
      today: DAY,
      now: '00:00',
      locale: 'ar',
      texts,
      prayer: UQ,
      days: 30,
    });
    expect(list).toHaveLength(30);
    expect(list[0]?.time).toBe(clockOf('2026-10-29T02:05:00.000Z', 10));
    for (const r of list) expect(r.time).toBe(anchorTimeOn({ prayer: 'fajr', offset: 10 }, r.date, UQ));
    // Fajr moves later through November in Makkah: the reminder moves with it.
    expect(list[29]!.time > list[0]!.time).toBe(true);
    expect(list[0]?.confirm).toEqual({ title: 'أذكار', body: 'سُجِّل لهذا اليوم.' });
  });

  it('stores a clock time for a new anchor: today’s prayer time, a typical one without a place, never a taken slot', () => {
    const fajr10 = clockOf('2026-10-29T02:05:00.000Z', 10);
    expect(anchorSlot({ prayer: 'fajr', offset: 10 }, DAY, UQ, [])).toBe(fajr10);
    expect(anchorSlot({ prayer: 'fajr', offset: 10 }, DAY, UQ, [fajr10])).not.toBe(fajr10);
    expect(anchorSlot({ prayer: 'asr', offset: 20 }, DAY, null, [])).toBe('15:50');
    expect(anchorSlot({ prayer: 'isha', offset: 0 }, DAY, null, ['19:30'])).toBe('19:31');
  });
});

describe('prefs: the prayer place stays well-formed and coarse', () => {
  it('keeps a valid place rounded to two decimals and a known method', () => {
    const prefs = parsePrefs({ v: 1, prayerPlace: { latitude: 21.42251, longitude: 39.82619, source: 'device' }, prayerMethod: 'mwl' });
    expect(prefs.prayerPlace).toEqual({ latitude: 21.42, longitude: 39.83, source: 'device' });
    expect(prefs.prayerMethod).toBe('mwl');
  });

  it('drops a broken place, an unknown city or method', () => {
    expect(parsePrefs({ v: 1, prayerPlace: { latitude: 120, longitude: 0 } }).prayerPlace).toBeNull();
    expect(parsePrefs({ v: 1, prayerPlace: { latitude: 'x', longitude: 0 } }).prayerPlace).toBeNull();
    expect(parsePrefs({ v: 1, prayerPlace: { latitude: 1, longitude: 2, source: 'city', city: 'atlantis' } }).prayerPlace).toEqual({
      latitude: 1,
      longitude: 2,
      source: 'city',
    });
    expect(parsePrefs({ v: 1, prayerMethod: 'tehran-ish' }).prayerMethod).toBeNull();
    expect(parsePrefs(null)).toMatchObject({ prayerPlace: null, prayerMethod: null });
  });
});
