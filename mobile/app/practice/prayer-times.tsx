/**
 * «مواقيت الصلاة»: where and how the «بعد الفجر» reminders compute prayer times. The place is the device's coarse
 * location (asked for only when «استخدم موقعي» is tapped), a city from the list, or typed coordinates; it stays in
 * the app prefs on this device. The method follows the country unless the user picks one. Today's five times show
 * what the reminders will follow.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { PRAYERS } from '@thekra/practice-core';
import { toWesternDigits } from '@/lib/practice/format';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import {
  PRAYER_CITIES,
  PRAYER_METHODS,
  effectiveMethod,
  isValidCoordinates,
  prayerClock,
  roundCoordinate,
  type PrayerCity,
  type PrayerContext,
  type PrayerMethod,
} from '@/lib/practice/prayer-times';
import {
  deviceRegion,
  useLocatePrayerPlace,
  usePrayerContext,
  usePrayerPlaceLabel,
  type LocateResult,
} from '@/lib/practice/use-prayer-place';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { space, useStyles } from '@/theme';
import { Button, CheckRow, Chip, ErrorText, Field, ListRow, Loading, PageHeader, Screen, Section, Text, Wrap } from '@/ui';

const makeStyles = () => ({
  group: { gap: space.md },
  coordinates: { writingDirection: 'ltr' as const, textAlign: 'left' as const },
  times: { gap: space.xs },
  timeRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, minHeight: 32, alignItems: 'center' as const },
});

/** Today's five times, or null where the place has none (polar days). */
function safeClock(ctx: PrayerContext) {
  try {
    return prayerClock(today(), ctx);
  } catch {
    return null;
  }
}

/** «21.42» from the user's text: Western digits, a comma read as a decimal point. */
function parseCoordinate(text: string): number {
  const normalized = toWesternDigits(text).trim().replace('٫', '.').replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
}

export default function PrayerTimesScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const place = usePracticeStore((s) => s.prefs.prayerPlace);
  const chosenMethod = usePracticeStore((s) => s.prefs.prayerMethod);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const ctx = usePrayerContext();
  const placeLabel = usePrayerPlaceLabel();
  const { locate, locating } = useLocatePrayerPlace();
  const [locateResult, setLocateResult] = useState<LocateResult | null>(null);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [manualError, setManualError] = useState(false);

  if (!hydrated) return <Loading />;

  const cityName = (c: PrayerCity) => (locale === 'en' ? c.nameEn : c.nameAr);
  const methodName = (m: PrayerMethod) => t(`prayerTimes.methods.${m}`);
  const clock = ctx ? safeClock(ctx) : null;
  const autoMethod = effectiveMethod(place, null, deviceRegion());

  async function handleLocate() {
    setLocateResult(await locate());
  }

  function chooseCity(city: PrayerCity) {
    setPrefs((p) => ({ ...p, prayerPlace: { latitude: city.latitude, longitude: city.longitude, source: 'city', city: city.key } }));
  }

  function saveManual() {
    const lat = parseCoordinate(latitude);
    const lon = parseCoordinate(longitude);
    if (!isValidCoordinates(lat, lon)) {
      setManualError(true);
      return;
    }
    setManualError(false);
    setPrefs((p) => ({ ...p, prayerPlace: { latitude: roundCoordinate(lat), longitude: roundCoordinate(lon), source: 'manual' } }));
  }

  function chooseMethod(next: PrayerMethod | null) {
    setPrefs((p) => ({ ...p, prayerMethod: next }));
  }

  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={t('prayerTimes.title')} lead={t('prayerTimes.lead')} />

      <Section title={t('prayerTimes.placeTitle')}>
        <View style={styles.group}>
          <ListRow icon={MapPin} title={placeLabel} />
          <Button label={t('practice.prayer.useLocation')} icon={LocateFixed} onPress={() => void handleLocate()} loading={locating} variant="outline" />
          {locateResult === 'denied' ? <ErrorText>{t('practice.prayer.locationDenied')}</ErrorText> : null}
          {locateResult === 'unavailable' ? <ErrorText>{t('practice.prayer.locationUnavailable')}</ErrorText> : null}
        </View>
      </Section>

      <Section title={t('prayerTimes.cityTitle')}>
        <Wrap>
          {PRAYER_CITIES.map((city) => (
            <Chip key={city.key} label={cityName(city)} selected={place?.city === city.key} onPress={() => chooseCity(city)} />
          ))}
        </Wrap>
      </Section>

      <Section title={t('prayerTimes.manualTitle')}>
        <View style={styles.group}>
          <Field
            label={t('prayerTimes.latitude')}
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="numbers-and-punctuation"
            autoComplete="off"
            textContentType="none"
            placeholder="21.42"
            style={styles.coordinates}
          />
          <Field
            label={t('prayerTimes.longitude')}
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numbers-and-punctuation"
            autoComplete="off"
            textContentType="none"
            placeholder="39.83"
            hint={t('prayerTimes.manualHint')}
            error={manualError ? t('prayerTimes.invalidCoordinates') : null}
            style={styles.coordinates}
          />
          <Button label={t('prayerTimes.saveManual')} onPress={saveManual} variant="outline" />
        </View>
      </Section>

      <Section title={t('prayerTimes.methodTitle')}>
        <View style={styles.group} accessibilityRole="radiogroup">
          <CheckRow
            radio
            title={t('prayerTimes.methodAuto', { method: methodName(autoMethod) })}
            checked={chosenMethod === null}
            onPress={() => chooseMethod(null)}
          />
          {PRAYER_METHODS.map((m) => (
            <CheckRow key={m} radio title={methodName(m)} checked={chosenMethod === m} onPress={() => chooseMethod(m)} />
          ))}
        </View>
      </Section>

      {clock ? (
        <Section title={t('prayerTimes.todayTitle')}>
          <View style={styles.times}>
            {PRAYERS.map((p) => (
              <View key={p} style={styles.timeRow}>
                <Text variant="body">{t(`practice.prayer.names.${p}`)}</Text>
                <Text variant="body" tone="muted">
                  {clock[p]}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}
