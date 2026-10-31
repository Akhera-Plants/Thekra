/**
 * «وضع رمضان» on «طاعاتي» (moved from the old «عاداتي» tab): one step up for every habit until the season ends, then
 * back on its own (practice-core `startSeason` / `normalize`).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Moon } from 'lucide-react-native';
import { addDays, normalize, startSeason } from '@thekra/practice-core';
import { shortDate } from '@/lib/practice/format';
import { eachPlan, ramadanSeasonUntil, seasonAmount } from '@/lib/practice/plan-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { space, useStyles } from '@/theme';
import { Button, Text } from '@/ui';

const makeStyles = () => ({
  group: { gap: space.md },
  tight: { gap: space.xs },
});

export function RamadanBlock() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const d = today();
  const seasonPlans = store.plans.filter((p) => p.season && d <= p.season.until);
  const season = ramadanSeasonUntil(d, store.settings.hijriOffset);

  function handleStart() {
    setStore((s) =>
      eachPlan(s, (p) => {
        const amount = seasonAmount(p);
        return amount > p.amount ? startSeason(p, amount, season.until) : null;
      }),
    );
  }

  function handleEnd() {
    // practice-core `normalize` restores the everyday amount once `until` has passed; ending early = the day after.
    setStore((s) => eachPlan(s, (p) => (p.season ? normalize(p, addDays(p.season.until, 1)) : null)));
  }

  const active = seasonPlans.length > 0;
  return (
    <View style={styles.group}>
      <View style={styles.tight}>
        <Text variant="heading" accessibilityRole="header">
          {t('practice.ramadan')}
        </Text>
        <Text variant="small" tone="muted">
          {active
            ? t('practice.ramadanActive', { date: shortDate(seasonPlans[0]!.season!.until) })
            : season.inRamadan
              ? t('practice.ramadanHint', { date: shortDate(season.until) })
              : t('practice.ramadanHintNotRamadan', { date: shortDate(season.until) })}
        </Text>
      </View>
      <Button
        label={active ? t('practice.ramadanEnd') : t('practice.ramadanStart')}
        icon={Moon}
        onPress={active ? handleEnd : handleStart}
        variant="outline"
      />
    </View>
  );
}
