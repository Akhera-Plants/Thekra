/**
 * The place and method of «بعد الفجر» reminders, for the screens.
 * - `usePrayerContext`: the stored place + the method in use (the user's, else the region's), or null.
 * - `useLocatePrayerPlace`: asks for location only when called (the user tapped «استخدم موقعي»), reads one coarse
 *   fix (expo-location, `Accuracy.Lowest`, about 3 km) and keeps it rounded in the prefs. Never sent anywhere.
 * - `usePrayerPlaceLabel`: the place in words (the Settings row and the prayer-times screen).
 */

import { useCallback, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { getLocales } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { usePracticeStore } from './practice-store';
import { PRAYER_CITIES, prayerContext, roundCoordinate, type PrayerContext } from './prayer-times';

/** A fix up to a day old is good enough for prayer times. */
const LAST_KNOWN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type LocateResult = 'ok' | 'denied' | 'unavailable';

export function deviceRegion(): string | null {
  return getLocales()[0]?.regionCode ?? null;
}

export function usePrayerContext(): PrayerContext | null {
  const place = usePracticeStore((s) => s.prefs.prayerPlace);
  const method = usePracticeStore((s) => s.prefs.prayerMethod);
  return useMemo(() => prayerContext(place, method, deviceRegion()), [place, method]);
}

export function useLocatePrayerPlace(): { locate: () => Promise<LocateResult>; locating: boolean } {
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [locating, setLocating] = useState(false);

  const locate = useCallback(async (): Promise<LocateResult> => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return 'denied';
      const fix =
        (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
      const { latitude, longitude } = fix.coords;
      setPrefs((p) => ({
        ...p,
        prayerPlace: { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude), source: 'device' },
      }));
      return 'ok';
    } catch {
      return 'unavailable';
    } finally {
      setLocating(false);
    }
  }, [setPrefs]);

  return { locate, locating };
}

/** «مكة المكرمة», «موقعي», «إحداثيات كتبتها» or «لم يُحدَّد بعد», in the UI language. */
export function usePrayerPlaceLabel(): string {
  const { t, i18n } = useTranslation();
  const place = usePracticeStore((s) => s.prefs.prayerPlace);
  if (!place) return t('prayerTimes.placeNone');
  const city = place.city ? PRAYER_CITIES.find((c) => c.key === place.city) : undefined;
  if (city) return i18n.language === 'en' ? city.nameEn : city.nameAr;
  return place.source === 'device' ? t('prayerTimes.placeDevice') : t('prayerTimes.placeManual');
}
