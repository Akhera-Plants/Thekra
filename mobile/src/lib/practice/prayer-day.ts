/**
 * Sunrise beside the five prayers (owner, 2026-11-01): Duha's window starts at sunrise + 15. AlAdhan sends `Sunrise`
 * in every day's timings; practice-core's `parseAlAdhan` keeps only the five prayers, so the app reads sunrise here and
 * keeps it in the same cached day (`sunrise`, raw: the user's minute offsets are for the prayers, not for sunrise).
 * Without it practice-core estimates sunrise late (fajr + 100), so a Duha time never falls before it. Pure.
 */

import {
  isValidDate,
  isValidTime,
  prayerTimesOn,
  type LocalDate,
  type LocalTime,
  type PrayerCache,
  type PrayerSettings,
  type PrayerTimes,
  type PrayerTimesWithSunrise,
} from '@thekra/practice-core';

/** `"06:12 (+03)"` → `"06:12"`. */
function cleanTime(v: unknown): LocalTime | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  const t = `${m[1]}:${m[2]}`;
  return isValidTime(t) ? t : null;
}

/** `"01-11-2026"` → `"2026-11-01"`. */
function cleanDate(v: unknown): LocalDate | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const d = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidDate(d) ? d : null;
}

/** Sunrise per date from an AlAdhan `calendarByCity` / `timingsByCity` response. Never throws. */
export function parseSunrise(json: unknown): Record<LocalDate, LocalTime> {
  const out: Record<LocalDate, LocalTime> = {};
  if (typeof json !== 'object' || json === null) return out;
  const data = (json as { data?: unknown }).data;
  const days = Array.isArray(data) ? data : data !== undefined ? [data] : [];
  for (const day of days) {
    if (typeof day !== 'object' || day === null) continue;
    const d = day as { timings?: Record<string, unknown>; date?: { gregorian?: { date?: unknown } } };
    const date = cleanDate(d.date?.gregorian?.date);
    const sunrise = cleanTime(d.timings?.Sunrise);
    if (date && sunrise) out[date] = sunrise;
  }
  return out;
}

/** The fetched days with their sunrise added (days without one stay as they are). */
export function withSunrise(
  days: Record<LocalDate, PrayerTimes>,
  sunrise: Record<LocalDate, LocalTime>,
): Record<LocalDate, PrayerTimesWithSunrise> {
  const out: Record<LocalDate, PrayerTimesWithSunrise> = {};
  for (const [date, times] of Object.entries(days)) out[date] = sunrise[date] ? { ...times, sunrise: sunrise[date] } : times;
  return out;
}

/** The day's prayer times with the user's offsets and the cached sunrise, or undefined (unknown day, no city). */
export function prayerDayOn(cache: PrayerCache | null, settings: PrayerSettings | null, date: LocalDate): PrayerTimesWithSunrise | undefined {
  const times = prayerTimesOn(cache, settings, date);
  if (!times) return undefined;
  const raw = cache?.days[date] as PrayerTimesWithSunrise | undefined;
  return raw?.sunrise && isValidTime(raw.sunrise) ? { ...times, sunrise: raw.sunrise } : times;
}

/** The cache has the day but not its sunrise (fetched before the app kept it). */
export function sunriseMissing(cache: PrayerCache | null, date: LocalDate): boolean {
  const day = cache?.days[date] as PrayerTimesWithSunrise | undefined;
  return Boolean(day) && !day?.sunrise;
}
