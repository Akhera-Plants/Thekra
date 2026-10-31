/**
 * Device-local data of phase 6 (redesign §4.6), never synced and never sent anywhere except as noted:
 * - «تذكيراتي»: the user's own short lines (practice-core `parseMyReminders`; ≤ 120 characters, at most 20).
 * - Prayer times: the chosen city/country/method/offsets and a 30-day AlAdhan cache. The browser sends only the
 *   resolved anchor times of the next days with its push subscription (`anchorTimesForPush`), so the server can plan
 *   «بعد الفجر» reminders without calling AlAdhan.
 */
import { useSyncExternalStore } from 'react';
import {
  alAdhanCalendarUrl,
  mergePrayerCache,
  monthsToFetch,
  parseAlAdhan,
  parseMyReminders,
  parsePrayerCache,
  parsePrayerSettings,
  prayerCacheStale,
  prayerLookup,
  PUSH_ANCHOR_DAYS,
  resolvedAnchorTimes,
  todayFrom,
  type MyReminder,
  type PrayerCache,
  type PrayerSettings,
  type PrayerTimesLookup,
  type PrayerTimes,
} from '@thekra/practice-core';
import { createDeviceStore } from './device-store';

export const MY_REMINDERS_KEY = 'thekra.practice.my-reminders.v1';
export const PRAYER_SETTINGS_KEY = 'thekra.practice.prayer-settings.v1';
export const PRAYER_CACHE_KEY = 'thekra.practice.prayer-cache.v1';

export const myRemindersStore = createDeviceStore<MyReminder[]>(MY_REMINDERS_KEY, parseMyReminders);
export const prayerSettingsStore = createDeviceStore<PrayerSettings | null>(PRAYER_SETTINGS_KEY, parsePrayerSettings);
export const prayerCacheStore = createDeviceStore<PrayerCache | null>(PRAYER_CACHE_KEY, parsePrayerCache);

export function useMyReminders(): MyReminder[] | null {
  return useSyncExternalStore(myRemindersStore.subscribe, myRemindersStore.get, myRemindersStore.getServer);
}

const noop = () => () => {};

/** False during the server render and hydration, true on the client after it. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function usePrayerSettings(): PrayerSettings | null {
  return useSyncExternalStore(prayerSettingsStore.subscribe, prayerSettingsStore.get, prayerSettingsStore.getServer);
}

/** The prayer-time lookup for anchored slots (default times when unset or offline). */
export function currentPrayerLookup(): PrayerTimesLookup {
  return prayerLookup(prayerCacheStore.get(), prayerSettingsStore.get());
}

export function usePrayerTimesToday(): PrayerTimes | undefined {
  const cache = useSyncExternalStore(prayerCacheStore.subscribe, prayerCacheStore.get, prayerCacheStore.getServer);
  const settings = useSyncExternalStore(prayerSettingsStore.subscribe, prayerSettingsStore.get, prayerSettingsStore.getServer);
  return prayerLookup(cache, settings)(todayFrom(new Date()));
}

const FETCH_TIMEOUT_MS = 10_000;

export type PrayerRefreshResult = 'fresh' | 'updated' | 'unset' | 'failed';

/**
 * Fetches the months that cover the next 30 days from AlAdhan when the cache is missing, belongs to other settings or
 * runs out within a week. Offline or on an error the old cache (or the default times) stays.
 */
export async function refreshPrayerTimes(force = false, fetchImpl: typeof fetch = fetch): Promise<PrayerRefreshResult> {
  const settings = prayerSettingsStore.get();
  if (!settings) return 'unset';
  const today = todayFrom(new Date());
  const cache = prayerCacheStore.get();
  if (!force && !prayerCacheStale(cache, settings, today)) return 'fresh';
  try {
    const fetched: Record<string, PrayerTimes> = {};
    for (const { year, month } of monthsToFetch(today)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetchImpl(alAdhanCalendarUrl(settings, year, month), { signal: controller.signal, credentials: 'omit' });
        if (!res.ok) return 'failed';
        Object.assign(fetched, parseAlAdhan(await res.json()));
      } finally {
        clearTimeout(timer);
      }
    }
    if (Object.keys(fetched).length === 0) return 'failed';
    prayerCacheStore.update((old) => mergePrayerCache(old, settings, fetched, today));
    return 'updated';
  } catch {
    return 'failed';
  }
}

/** The resolved anchor times this browser sends with its push prefs (empty when no city is set). */
export function anchorTimesForPush(): ReturnType<typeof resolvedAnchorTimes> {
  return resolvedAnchorTimes(currentPrayerLookup(), todayFrom(new Date()), PUSH_ANCHOR_DAYS);
}
