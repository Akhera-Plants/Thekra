/**
 * Prayer times on the device (redesign §4.6): the city in «أوقات الصلاة» → 30 days of AlAdhan times kept in the
 * practice prefs (`prayerCache`). Refetched on foreground when fewer than 7 days are left; offline, or before a city
 * is set, anchored slots use practice-core's default times.
 */
import {
  alAdhanCalendarUrl,
  mergePrayerCache,
  monthsToFetch,
  parseAlAdhan,
  prayerCacheStale,
  prayerLookup,
  type PrayerTimes,
  type PrayerTimesLookup,
} from '@thekra/practice-core';
import { today, usePracticeStore } from './practice-store';

const TIMEOUT_MS = 10_000;

export type PrayerRefresh = 'fresh' | 'updated' | 'unset' | 'failed';

export async function refreshPrayerTimes(force = false, fetchImpl: typeof fetch = fetch): Promise<PrayerRefresh> {
  const { prefs, hydrated, setPrefs } = usePracticeStore.getState();
  const settings = prefs.prayer;
  if (!hydrated || !settings) return 'unset';
  const day = today();
  if (!force && !prayerCacheStale(prefs.prayerCache, settings, day)) return 'fresh';
  try {
    const fetched: Record<string, PrayerTimes> = {};
    for (const { year, month } of monthsToFetch(day)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetchImpl(alAdhanCalendarUrl(settings, year, month), { signal: controller.signal });
        if (!res.ok) return 'failed';
        Object.assign(fetched, parseAlAdhan(await res.json()));
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

/** The lookup for anchored slots from the current prefs. */
export function currentPrayerLookup(): PrayerTimesLookup {
  const { prefs } = usePracticeStore.getState();
  return prayerLookup(prefs.prayerCache, prefs.prayer);
}
