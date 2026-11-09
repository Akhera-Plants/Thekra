/**
 * «وضع رمضان» in «عاداتي»: one step up for every habit until the last day of Ramadan, then back on its own
 * (practice-core `startSeason` / `normalize`). Shown only in Ramadan (Umm al-Qura + the user's offset), and outside it
 * only to end a season that is still running (`showRamadanBlock`).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Moon } from 'lucide-react-native';
import { addDays, normalize, startSeason } from '@thekra/practice-core';
import { useShortDate } from '@/lib/practice/use-habits-hub';
import { eachPlan, ramadanSeasonUntil, seasonAmount, showRamadanBlock } from '@/lib/practice/plan-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { space, useStyles } from '@/theme';
import { Button, Text } from '@/ui';

const makeStyles = () => ({
  group: { gap: space.md },
  tight: { gap: space.xs },
});

export function RamadanBlock() {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const d = today();
  const seasonPlans = store.plans.filter((p) => p.season && d <= p.season.until);
  const until = ramadanSeasonUntil(d, store.settings.hijriOffset);

  function handleStart() {
    if (!until) return;
    setStore((s) =>
      eachPlan(s, (p) => {
        const amount = seasonAmount(p);
        return amount > p.amount ? startSeason(p, amount, until) : null;
      }),
    );
  }

  function handleEnd() {
    // practice-core `normalize` restores the everyday amount once `until` has passed; ending early = the day after.
    setStore((s) => eachPlan(s, (p) => (p.season ? normalize(p, addDays(p.season.until, 1)) : null)));
  }

  const active = seasonPlans.length > 0;
  if (!showRamadanBlock(until, active) || store.plans.length === 0) return null;
  return (
    <View style={styles.group}>
      <View style={styles.tight}>
        <Text variant="heading" accessibilityRole="header">
          {t('practice.ramadan')}
        </Text>
        <Text variant="small" tone="muted">
          {active
            ? t('practice.ramadanActive', { date: shortDate(seasonPlans[0]!.season!.until) })
            : t('practice.ramadanHint', { date: shortDate(until ?? d) })}
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
