/**
 * «أوقات الصلاة» (redesign §4.6): the city whose prayer times anchor «بعد الفجر»… reminders. The app fetches 30 days
 * from AlAdhan (method by country unless chosen, manual minutes per prayer) and keeps them on the device; without a
 * city or offline the anchors use default times.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ALADHAN_METHODS,
  ANCHOR_LABELS,
  defaultMethodForCountry,
  emptyOffsets,
  MAX_CITY_LENGTH,
  MAX_PRAYER_OFFSET,
  parsePrayerSettings,
  PRAYER_ANCHORS,
  PRAYERS,
  resolveAnchor,
  type Prayer,
} from '@thekra/practice-core';
import { useDisplayTime } from '@/components/practice/editors';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { currentPrayerLookup, refreshPrayerTimes } from '@/lib/practice/prayer';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { space, useStyles, type Theme } from '@/theme';
import { Button, Chip, Field, ListRow, Notice, PageHeader, Screen, Section, Text } from '@/ui';

const makeStyles = (_t: Theme) => ({
  stack: { gap: space.md },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  offsets: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  offset: { width: 96 },
});

type Status = 'idle' | 'saving' | 'saved' | 'failed';

export default function PrayerTimesScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const saved = usePracticeStore((s) => s.prefs.prayer);
  usePracticeStore((s) => s.prefs.prayerCache); // re-render when new times arrive
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [city, setCity] = useState(saved?.city ?? '');
  const [country, setCountry] = useState(saved?.country ?? '');
  const [method, setMethod] = useState<number | null>(saved?.method ?? null);
  const [offsets, setOffsets] = useState<Record<Prayer, number>>(saved?.offsets ?? emptyOffsets());
  const [status, setStatus] = useState<Status>('idle');
  const effective = method ?? (country.length === 2 ? defaultMethodForCountry(country) : null);
  const times = currentPrayerLookup()(today());
  const show = useDisplayTime();

  async function save() {
    const next = parsePrayerSettings({ city, country, method: effective ?? undefined, offsets });
    if (!next) {
      setStatus('failed');
      return;
    }
    setStatus('saving');
    setPrefs((p) => ({ ...p, prayer: next }));
    setStatus((await refreshPrayerTimes(true)) === 'updated' ? 'saved' : 'failed');
  }

  return (
    <Screen edges={['bottom']} keyboard decor>
      <PageHeader title={t('prayerTimes.title')} lead={t('prayerTimes.lead')} />
      <Section>
        <View style={styles.stack}>
          <Field label={t('prayerTimes.city')} value={city} maxLength={MAX_CITY_LENGTH} onChangeText={setCity} />
          <Field
            label={t('prayerTimes.country')}
            value={country}
            maxLength={2}
            autoCapitalize="characters"
            onChangeText={(v) => setCountry(v.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <Text variant="label">{t('prayerTimes.method')}</Text>
          <View style={styles.chips}>
            {ALADHAN_METHODS.map((m) => (
              <Chip key={m.id} label={locale === 'en' ? m.en : m.ar} selected={effective === m.id} onPress={() => setMethod(m.id)} />
            ))}
          </View>
          <Text variant="label">{t('prayerTimes.offsets')}</Text>
          <View style={styles.offsets}>
            {PRAYERS.map((p) => (
              <View key={p} style={styles.offset}>
                <Field
                  label={t(`prayerTimes.prayers.${p}`)}
                  value={String(offsets[p])}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(v) => {
                    const n = Math.max(-MAX_PRAYER_OFFSET, Math.min(MAX_PRAYER_OFFSET, Math.round(Number(v) || 0)));
                    setOffsets({ ...offsets, [p]: n });
                  }}
                />
              </View>
            ))}
          </View>
          <Button label={status === 'saving' ? t('prayerTimes.saving') : t('prayerTimes.save')} onPress={() => void save()} disabled={status === 'saving'} />
          {saved ? (
            <Button
              variant="outline"
              label={t('prayerTimes.clear')}
              onPress={() => setPrefs((p) => ({ ...p, prayer: null, prayerCache: null }))}
            />
          ) : null}
          {status === 'saved' ? <Notice>{t('prayerTimes.saved')}</Notice> : null}
          {status === 'failed' ? <Notice tone="destructive">{t('prayerTimes.failed')}</Notice> : null}
          {status === 'idle' ? (
            <Text variant="small" tone="muted">
              {t('prayerTimes.helper')}
            </Text>
          ) : null}
        </View>
      </Section>
      <Section title={t('prayerTimes.anchorsTitle')}>
        {PRAYER_ANCHORS.map((anchor) => (
          <ListRow key={anchor} title={ANCHOR_LABELS[locale][anchor]} value={show(resolveAnchor(anchor, times))} />
        ))}
        {!times ? (
          <Text variant="small" tone="muted">
            {t('prayerTimes.defaults')}
          </Text>
        ) : null}
      </Section>
    </Screen>
  );
}
