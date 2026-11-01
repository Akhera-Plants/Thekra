/**
 * Prayer times on the device (redesign §4.6): the city in «أوقات الصلاة» → 30 days of AlAdhan times kept in the
 * practice prefs (`prayerCache`), each day with its sunrise (`prayer-day.ts`, for Duha's window). Refetched on
 * foreground when fewer than 7 days are left, and once per app run when the cached days predate sunrise; offline, or
 * before a city is set, anchored slots use practice-core's default times.
 */
import {
  alAdhanCalendarUrl,
  mergePrayerCache,
  monthsToFetch,
  parseAlAdhan,
  prayerCacheStale,
  prayerLookup,
  type LocalDate,
  type PrayerTimes,
  type PrayerTimesLookup,
  type PrayerTimesWithSunrise,
} from '@thekra/practice-core';
import { parseSunrise, prayerDayOn, sunriseMissing, withSunrise } from './prayer-day';
import { today, usePracticeStore } from './practice-store';

const TIMEOUT_MS = 10_000;

export type PrayerRefresh = 'fresh' | 'updated' | 'unset' | 'failed';

/** A cache from before sunrise was kept is refetched once per app run, never in a loop. */
let sunriseRefetched = false;

export async function refreshPrayerTimes(force = false, fetchImpl: typeof fetch = fetch): Promise<PrayerRefresh> {
  const { prefs, hydrated, setPrefs } = usePracticeStore.getState();
  const settings = prefs.prayer;
  if (!hydrated || !settings) return 'unset';
  const day = today();
  const addSunrise = !sunriseRefetched && sunriseMissing(prefs.prayerCache, day);
  if (!force && !addSunrise && !prayerCacheStale(prefs.prayerCache, settings, day)) return 'fresh';
  if (addSunrise) sunriseRefetched = true;
  try {
    const fetched: Record<string, PrayerTimesWithSunrise> = {};
    for (const { year, month } of monthsToFetch(day)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetchImpl(alAdhanCalendarUrl(settings, year, month), { signal: controller.signal });
        if (!res.ok) return 'failed';
        const json: unknown = await res.json();
        Object.assign(fetched, withSunrise(parseAlAdhan(json) as Record<string, PrayerTimes>, parseSunrise(json)));
      } finally {
        clearTimeout(timer);
      }
    }
    if (Object.keys(fetched).length === 0) return 'failed';
    setPrefs((p) => ({ ...p, prayerCache: mergePrayerCache(p.prayerCache, settings, fetched, day) }));
    return 'updated';
  } catch {
    return 'failed';
  }
}

/** The day's prayer times with sunrise (for deed windows), from the current prefs; undefined without a city. */
export function currentPrayerDay(date: LocalDate): PrayerTimesWithSunrise | undefined {
  const { prefs } = usePracticeStore.getState();
  return prayerDayOn(prefs.prayerCache, prefs.prayer, date);
}

/** The lookup for anchored slots from the current prefs. */
export function currentPrayerLookup(): PrayerTimesLookup {
  const { prefs } = usePracticeStore.getState();
  return prayerLookup(prefs.prayerCache, prefs.prayer);
}
