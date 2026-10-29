/**
 * A month as a 7-column grid, shared by the «عاداتي» hub («وين وصلت هذا الشهر»: presence fills) and the calendar page
 * (sunnah occasions only). The first day of the week sits at the reading start; each day is a button labelled with its
 * full Gregorian and Hijri date; today is outlined, the selected day ringed, a small gold dot marks an occasion.
 * No run lengths: a day shows only whether something, or all of it, was done.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LocalDate } from '@thekra/practice-core';
import { dayTitle, hijriMonthsTitle, monthTitle, monthWeeks, weekdayOrder } from '@/lib/practice/calendar-grid';
import type { PresenceMark } from '@/lib/practice/hub';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { BackChevron, ForwardChevron, Text } from '@/ui';

const CELL = 40;

const makeStyles = (t: Theme) => ({
  root: { gap: space.sm },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs },
  titles: { flex: 1 },
  row: { flexDirection: 'row' as const },
  weekday: { flex: 1, alignItems: 'center' as const, paddingVertical: space.xs },
  cell: { flex: 1, minHeight: 52, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2 },
  day: {
    width: CELL,
    height: CELL,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  full: { backgroundColor: t.colors.primary },
  partial: { backgroundColor: t.colors.flourish },
  today: { borderColor: t.colors.ring },
  selected: { borderColor: t.colors.foreground, borderWidth: 2 },
  dot: { width: 5, height: 5, borderRadius: radius.full },
  occasionDot: { backgroundColor: t.colors.intentGoodDeed },
  step: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const },
  stepPressed: { backgroundColor: t.colors.accent },
});

export interface StepButtonProps {
  direction: 'back' | 'forward';
  label: string;
  onPress: () => void;
}

/** A 48 round previous/next control whose chevron points the reading way. */
export function StepButton({ direction, label, onPress }: StepButtonProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: colors.accent, borderless: true, radius: 24 }}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
    >
      {direction === 'back' ? <BackChevron size={20} tone="muted" /> : <ForwardChevron size={20} tone="muted" />}
    </Pressable>
  );
}

export interface MonthGridProps {
  /** Any day of the month to show. */
  month: LocalDate;
  /** First weekday (0 = Sunday), see `firstWeekday`. */
  first: number;
  today: LocalDate;
  selected: LocalDate | null;
  /** Presence per day (the hub); absent on the calendar page. */
  marks?: ReadonlyMap<LocalDate, PresenceMark>;
  /** Days with a sunnah occasion. */
  occasions?: ReadonlySet<LocalDate>;
  onSelect: (date: LocalDate) => void;
  onShiftMonth: (delta: number) => void;
}

interface CellModel {
  date: LocalDate;
  label: string;
  mark: PresenceMark | undefined;
  occasion: boolean;
}

export function MonthGrid({ month, first, today, selected, marks, occasions, onSelect, onShiftMonth }: MonthGridProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);

  const weeks = useMemo<(CellModel | null)[][]>(
    () =>
      monthWeeks(month, first).map((week) =>
        week.map((date) => {
          if (!date) return null;
          const mark = marks?.get(date);
          const occasion = occasions?.has(date) ?? false;
          const parts = [dayTitle(date, hijriOffset, names)];
          if (date === today) parts.push(t('practice.today'));
          if (mark === 'full') parts.push(t('practice.hub.markFull'));
          if (mark === 'partial') parts.push(t('practice.hub.markPartial'));
          if (occasion) parts.push(t('practice.hub.occasionTag'));
          return { date, label: parts.join(t('practice.hub.separator')), mark, occasion };
        }),
      ),
    [month, first, marks, occasions, hijriOffset, names, today, t],
  );
  const hijri = useMemo(
    () => hijriMonthsTitle(month, hijriOffset, names, t('practice.hub.separator')),
    [month, hijriOffset, names, t],
  );
  const handlePrev = useCallback(() => onShiftMonth(-1), [onShiftMonth]);
  const handleNext = useCallback(() => onShiftMonth(1), [onShiftMonth]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text variant="heading" accessibilityRole="header">
            {monthTitle(month, names)}
          </Text>
          {hijri ? (
            <Text variant="caption" tone="muted">
              {hijri}
            </Text>
          ) : null}
        </View>
        <StepButton direction="back" label={t('practice.hub.previousMonth')} onPress={handlePrev} />
        <StepButton direction="forward" label={t('practice.hub.nextMonth')} onPress={handleNext} />
      </View>

      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {weekdayOrder(first).map((day) => (
          <View key={day} style={styles.weekday}>
            <Text variant="caption" tone="muted">
              {t(`practice.hub.weekdayShort.${day}`)}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={week.find(Boolean)?.date} style={styles.row}>
          {week.map((cell, i) =>
            cell ? (
              <MonthCell
                key={cell.date}
                date={cell.date}
                label={cell.label}
                mark={cell.mark}
                occasion={cell.occasion}
                isToday={cell.date === today}
                isSelected={cell.date === selected}
                onSelect={onSelect}
              />
            ) : (
              <View key={`blank-${i}`} style={styles.cell} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

interface MonthCellProps {
  date: LocalDate;
  label: string;
  mark: PresenceMark | undefined;
  occasion: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: LocalDate) => void;
}

const MonthCell = memo(function MonthCell({ date, label, mark, occasion, isToday, isSelected, onSelect }: MonthCellProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const handlePress = useCallback(() => onSelect(date), [onSelect, date]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      android_ripple={{ color: colors.accent, borderless: true, radius: 24 }}
      style={styles.cell}
    >
      <View
        style={[
          styles.day,
          mark === 'full' && styles.full,
          mark === 'partial' && styles.partial,
          isToday && styles.today,
          isSelected && styles.selected,
        ]}
      >
        <Text variant="small" weight={isToday || isSelected ? 'semibold' : 'regular'} tone={mark === 'full' ? 'inverse' : 'default'}>
          {String(Number(date.slice(8, 10)))}
        </Text>
      </View>
      <View style={[styles.dot, occasion && styles.occasionDot]} />
    </Pressable>
  );
});
