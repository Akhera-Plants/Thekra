/**
 * «وين وصلت هذا الشهر»: the days present in the last 30 and the kind band (practice-core `monthSummary`, never a run
 * length), then the month grid of the selected day with presence fills and occasion dots, and a small legend.
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LocalDate } from '@thekra/practice-core';
import type { PresenceMark } from '@/lib/practice/hub';
import type { TrackSummary } from '@/lib/practice/use-habits-hub';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Section, Text } from '@/ui';
import { MonthGrid } from './MonthGrid';

const SWATCH = 12;

const makeStyles = (t: Theme) => ({
  legend: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, columnGap: space.lg, rowGap: space.xs },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: radius.full },
  full: { backgroundColor: t.colors.primary },
  partial: { backgroundColor: t.colors.flourish },
  occasion: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: t.colors.intentGoodDeed },
});

export interface PresenceMonthProps {
  summary: TrackSummary;
  month: LocalDate;
  first: number;
  today: LocalDate;
  selected: LocalDate;
  marks: ReadonlyMap<LocalDate, PresenceMark>;
  occasions: ReadonlySet<LocalDate>;
  onSelect: (date: LocalDate) => void;
  onShiftMonth: (delta: number) => void;
}

export function PresenceMonth({ summary, month, first, today, selected, marks, occasions, onSelect, onShiftMonth }: PresenceMonthProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Section title={t('practice.hub.monthTitle')} lead={t('practice.hub.monthLead')}>
      <Text variant="body">
        {t('practice.hub.presentDays', { count: summary.presentDays })}
        {summary.band ? (
          <Text variant="body" weight="medium" tone="link">
            {` · ${t(`practice.band.${summary.band}`)}`}
          </Text>
        ) : null}
      </Text>
      <MonthGrid
        month={month}
        first={first}
        today={today}
        selected={selected}
        marks={marks}
        occasions={occasions}
        onSelect={onSelect}
        onShiftMonth={onShiftMonth}
      />
      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.full]} />
          <Text variant="caption" tone="muted">
            {t('practice.hub.legendFull')}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.partial]} />
          <Text variant="caption" tone="muted">
            {t('practice.hub.legendPartial')}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.occasion} />
          <Text variant="caption" tone="muted">
            {t('practice.hub.occasionTag')}
          </Text>
        </View>
      </View>
    </Section>
  );
}
