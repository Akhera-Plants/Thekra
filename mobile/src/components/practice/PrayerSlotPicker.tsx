/**
 * «بعد صلاة»: the part of the slot editor that adds a reminder after one of the five prayers, `offset` minutes after
 * the adhan. Without a place yet it first asks for one: the device location (asked for only on that tap) or a city
 * on the prayer-times screen. The place stays on the device.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus } from 'lucide-react-native';
import { DEFAULT_PRAYER_OFFSET, PRAYERS, type PlanAnchor, type Prayer } from '@thekra/practice-core';
import { useLocatePrayerPlace, usePrayerContext, type LocateResult } from '@/lib/practice/use-prayer-place';
import { space, useStyles } from '@/theme';
import { Button, Chip, ErrorText, Notice, Text, Wrap } from '@/ui';

const OFFSET_CHOICES = [0, 5, 10, 15, 20, 30, 45, 60];

const makeStyles = () => ({
  group: { gap: space.md },
  field: { gap: space.sm },
});

export interface PrayerSlotPickerProps {
  anchors: readonly PlanAnchor[];
  /** The catalog's suggestion for this habit (an organizational one). */
  suggested?: readonly Omit<PlanAnchor, 'slot'>[];
  onAdd: (anchor: Omit<PlanAnchor, 'slot'>) => void;
}

export function PrayerSlotPicker({ anchors, suggested, onAdd }: PrayerSlotPickerProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const prayerContext = usePrayerContext();
  const { locate, locating } = useLocatePrayerPlace();
  const [locateResult, setLocateResult] = useState<LocateResult | null>(null);
  const firstSuggestion = suggested?.find((s) => !anchors.some((a) => a.prayer === s.prayer));
  const [prayer, setPrayer] = useState<Prayer>(firstSuggestion?.prayer ?? 'fajr');
  const [offset, setOffset] = useState(firstSuggestion?.offset ?? DEFAULT_PRAYER_OFFSET);
  const taken = anchors.some((a) => a.prayer === prayer);
  const offsets = OFFSET_CHOICES.includes(offset) ? OFFSET_CHOICES : [...OFFSET_CHOICES, offset].sort((a, b) => a - b);

  async function handleLocate() {
    setLocateResult(await locate());
  }

  function handlePrayer(next: Prayer) {
    setPrayer(next);
    const hint = suggested?.find((s) => s.prayer === next);
    if (hint) setOffset(hint.offset);
  }

  return (
    <View style={styles.group}>
      {suggested && suggested.length > 0 ? (
        <Text variant="small" tone="muted">
          {t('practice.prayer.suggested', {
            prayers: suggested.map((s) => t(`practice.prayer.names.${s.prayer}`)).join(t('practice.prayer.listSeparator')),
          })}
        </Text>
      ) : null}
      {prayerContext ? null : (
        <View style={styles.field}>
          <Notice icon={MapPin}>{t('practice.prayer.needPlace')}</Notice>
          <Wrap>
            <Button label={t('practice.prayer.useLocation')} onPress={() => void handleLocate()} loading={locating} />
            <Button label={t('practice.prayer.chooseCity')} onPress={() => router.push('/practice/prayer-times')} variant="outline" />
          </Wrap>
          {locateResult === 'denied' ? <ErrorText>{t('practice.prayer.locationDenied')}</ErrorText> : null}
          {locateResult === 'unavailable' ? <ErrorText>{t('practice.prayer.locationUnavailable')}</ErrorText> : null}
        </View>
      )}
      <View style={styles.field}>
        <Text variant="label">{t('practice.prayer.whichPrayer')}</Text>
        <Wrap>
          {PRAYERS.map((p) => (
            <Chip key={p} label={t(`practice.prayer.names.${p}`)} selected={prayer === p} onPress={() => handlePrayer(p)} />
          ))}
        </Wrap>
      </View>
      <View style={styles.field}>
        <Text variant="label">{t('practice.prayer.howLong')}</Text>
        <Wrap>
          {offsets.map((n) => (
            <Chip
              key={n}
              label={n === 0 ? t('practice.prayer.atAdhan') : t('practice.prayer.minutes', { count: n })}
              selected={offset === n}
              onPress={() => setOffset(n)}
            />
          ))}
        </Wrap>
      </View>
      {taken ? (
        <Text variant="small" tone="muted">
          {t('practice.prayer.alreadyAdded')}
        </Text>
      ) : null}
      <Button
        label={t('practice.prayer.add')}
        icon={Plus}
        variant="outline"
        disabled={taken || !prayerContext}
        onPress={() => onAdd({ prayer, offset })}
      />
    </View>
  );
}
