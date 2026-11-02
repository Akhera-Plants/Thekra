/**
 * «نسبة الالتزام» in «عاداتي» › «الإحصاء» (owner round 3, item 9): one bar per habit over the last 30 full days
 * (src/lib/practice/commitment.ts on practice-core `adherence`), the share of its asked days with anything logged.
 * Bars start on the reading side (RTL-aware through flex), one brand colour, the value written beside each bar (no
 * colour-only meaning), Western digits. Kind words only: no band reads as a failure.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { COMMITMENT_DAYS, commitmentRates, meanCommitment } from '@/lib/practice/commitment';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Text } from '@/ui';
import type { LocalDate } from '@thekra/practice-core';

const BAR = 10;

const makeStyles = (t: Theme) => ({
  root: { gap: space.md },
  rows: { gap: space.md },
  row: { gap: 6 },
  head: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: space.sm },
  name: { flex: 1, minWidth: 0 },
  track: { height: BAR, borderRadius: radius.full, backgroundColor: t.colors.muted, overflow: 'hidden' as const, flexDirection: 'row' as const },
  fill: { height: BAR, borderRadius: radius.full, backgroundColor: t.colors.primary },
});

export function CommitmentChart({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const rates = useMemo(
    () => commitmentRates(store, today, { isPeriodicAct: (plan) => habitFor(plan, habits)?.kind === 'periodic' }),
    [store, today, habits],
  );
  const mean = meanCommitment(rates);

  return (
    <View style={styles.root}>
      <View>
        <Text variant="title" accessibilityRole="header">
          {t('record.commitment.title')}
        </Text>
        <Text variant="small" tone="muted">
          {t('record.commitment.lead', { days: COMMITMENT_DAYS })}
        </Text>
      </View>
      {rates.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('record.commitment.empty')}
        </Text>
      ) : (
        <>
          {mean !== null ? <Text variant="body">{t('record.commitment.mean', { percent: Math.round(mean * 100) })}</Text> : null}
          <View style={styles.rows}>
            {rates.map((rate) => {
              const plan = store.plans.find((p) => p.id === rate.planId);
              if (!plan) return null;
              const habit = habitFor(plan, habits);
              const name = habit ? pick(habit, 'title', locale) : plan.title;
              return (
                <View
                  key={rate.planId}
                  style={styles.row}
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel={`${name}: ${rate.percent}%`}
                  accessibilityValue={{ min: 0, max: 100, now: rate.percent }}
                >
                  <View style={styles.head}>
                    <Text variant="body" style={styles.name} numberOfLines={2}>
                      {name}
                    </Text>
                    <Text variant="small" weight="medium" tone="link">
                      {`${rate.percent}%`}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.max(rate.percent, rate.percent > 0 ? 3 : 0)}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
