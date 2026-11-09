/**
 * «أوقات الصلاة» (redesign §4.6; owner round 5, F-27 note): the user types only a city. «احفظ» (full width) asks
 * AlAdhan for that city (`timingsByAddress`), reads where it placed it and the method it chose (practice-core
 * `alAdhanTimingsUrl` / `parseAlAdhanMeta`), saves both and fetches 30 days of times for the device; a city it cannot
 * place and an offline device each get their own line, and nothing is saved. The resolved place and method show in one
 * line. No country field (A-32 superseded). The method and the manual minutes stay behind one row each, so the form
 * stays short; «امسح» is in the header's «⋯». Without a city, anchored slots use default times.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Calculator, ChevronDown, ChevronUp, MapPin, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ALADHAN_METHODS,
  ANCHOR_LABELS,
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
import { currentPrayerLookup, lookupCity, refreshPrayerTimes } from '@/lib/practice/prayer';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { cityLabel } from '@/lib/practice/city-name';
import { space, useStyles, type Theme } from '@/theme';
import { ActionMenu, BottomSheet, Button, Chip, ErrorText, Field, Icon, ListRow, Notice, PageHeader, Screen, Section, SectionDivider, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  stack: { gap: space.md },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  offsets: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  offset: { width: 96 },
  place: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  placeText: { flex: 1, minWidth: 0 },
  toggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  toggleText: { flex: 1, minWidth: 0 },
});

type Status = 'idle' | 'saving' | 'notFound' | 'offline' | 'failed';

export default function PrayerTimesScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const saved = usePracticeStore((s) => s.prefs.prayer);
  usePracticeStore((s) => s.prefs.prayerCache); // re-render when new times arrive
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const [city, setCity] = useState(saved?.city ?? '');
  // A method chosen by hand; otherwise AlAdhan's choice for the city is used and stored.
  const [method, setMethod] = useState<number | null>(saved?.method ?? null);
  const [offsets, setOffsets] = useState<Record<Prayer, number>>(saved?.offsets ?? emptyOffsets());
  const [status, setStatus] = useState<Status>('idle');
  const [zone, setZone] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [tuning, setTuning] = useState(false);
  const methodName = (id: number | null | undefined) => {
    const m = ALADHAN_METHODS.find((x) => x.id === id);
    return m ? (locale === 'en' ? m.en : m.ar) : null;
  };
  const times = currentPrayerLookup()(today());
  const show = useDisplayTime();

  async function save() {
    setStatus('saving');
    const found = await lookupCity(city, today());
    if (found.kind !== 'found') {
      setStatus(found.kind);
      return;
    }
    const next = parsePrayerSettings({ city, method: method ?? found.meta.method ?? undefined, offsets });
    if (!next) {
      setStatus('notFound');
      return;
    }
    setPrefs((p) => ({ ...p, prayer: next }));
    setZone(found.meta.timezone);
    if ((await refreshPrayerTimes(true)) !== 'updated') {
      setStatus('offline');
      return;
    }
    setStatus('idle');
    setMethod(next.method ?? null);
    toast(t('prayerTimes.saved'));
    if (router.canGoBack()) router.back();
  }

  function clear() {
    setPrefs((p) => ({ ...p, prayer: null, prayerCache: null }));
    setCity('');
    setMethod(null);
    setZone(null);
    toast(t('habitsTab.prayer.cleared'));
  }

  const savedLine = saved
    ? [cityLabel(saved.city, locale), zone, methodName(saved.method)].filter(Boolean).join(' · ')
    : null;

  return (
    <Screen edges={['bottom']} keyboard>
      <Stack.Screen
        options={{
          headerRight: saved
            ? () => (
                <ActionMenu
                  items={[
                    {
                      label: t('prayerTimes.clear'),
                      icon: Trash2,
                      destructive: true,
                      onPress: clear,
                      confirm: { title: t('prayerTimes.clear'), message: t('habitsTab.prayer.clearConfirm'), confirmLabel: t('prayerTimes.clear') },
                    },
                  ]}
                />
              )
            : undefined,
        }}
      />
      <PageHeader title={t('prayerTimes.title')} lead={t('habitsTab.prayer.lead')} />
      <Section>
        <View style={styles.stack}>
          {savedLine ? (
            <View style={styles.place}>
              <Icon icon={MapPin} size={18} tone="link" />
              <Text variant="small" style={styles.placeText}>
                {savedLine}
              </Text>
            </View>
          ) : null}
          <Field
            label={t('prayerTimes.city')}
            placeholder={t('habitsTab.prayer.cityPlaceholder')}
            value={city}
            maxLength={MAX_CITY_LENGTH}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            onChangeText={(v) => {
              setCity(v);
              if (status !== 'saving') setStatus('idle');
            }}
          />
          {status === 'notFound' ? <ErrorText>{t('habitsTab.prayer.notFound')}</ErrorText> : null}
          {status === 'offline' ? <Notice tone="destructive">{t('habitsTab.prayer.offline')}</Notice> : null}
          <Button
            size="lg"
            label={status === 'saving' ? t('prayerTimes.saving') : t('prayerTimes.save')}
            onPress={() => void save()}
            disabled={status === 'saving' || city.trim().length === 0}
            loading={status === 'saving'}
          />
          <View>
            <ListRow
              icon={Calculator}
              title={t('prayerTimes.method')}
              value={methodName(method) ?? t('habitsTab.prayer.methodAuto')}
              chevron
              onPress={() => setPicking(true)}
            />
            <Pressable
              onPress={() => setTuning((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: tuning }}
              style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.7 }]}
            >
              <Icon icon={SlidersHorizontal} size={24} tone="link" strokeWidth={1.3} />
              <Text variant="body" style={styles.toggleText}>
                {t('prayerTimes.offsets')}
              </Text>
              <Icon icon={tuning ? ChevronUp : ChevronDown} size={18} tone="muted" />
            </Pressable>
          </View>
          {tuning ? (
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
          ) : null}
        </View>
      </Section>
      <SectionDivider />
      <Section title={t('prayerTimes.anchorsTitle')}>
        {PRAYER_ANCHORS.map((anchor, i) => (
          <ListRow key={anchor} title={ANCHOR_LABELS[locale][anchor]} value={show(resolveAnchor(anchor, times))} last={i === PRAYER_ANCHORS.length - 1} />
        ))}
        {!times ? (
          <Text variant="small" tone="muted">
            {t('prayerTimes.defaults')}
          </Text>
        ) : null}
      </Section>

      <BottomSheet visible={picking} title={t('prayerTimes.method')} onClose={() => setPicking(false)}>
        <View style={styles.chips}>
          <Chip
            label={t('habitsTab.prayer.methodAuto')}
            selected={method === null}
            onPress={() => {
              setMethod(null);
              setPicking(false);
            }}
          />
          {ALADHAN_METHODS.map((m) => (
            <Chip
              key={m.id}
              label={locale === 'en' ? m.en : m.ar}
              selected={method === m.id}
              onPress={() => {
                setMethod(m.id);
                setPicking(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}
