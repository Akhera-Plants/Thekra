/**
 * The hub's week strip: the week of the selected day in reading order (Saturday first in Arabic), each day a button
 * with its weekday letter and number, today outlined, the selected day a filled pill, and a small presence mark under
 * it (empty / ring / filled; nothing for days still to come). Previous and next week, and «اليوم» to come back.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { weekday, type LocalDate } from '@thekra/practice-core';
import { dayTitle, monthTitle } from '@/lib/practice/calendar-grid';
import type { PresenceMark } from '@/lib/practice/hub';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, Text } from '@/ui';
import { StepButton } from './MonthGrid';

const PILL = 40;
const MARK = 6;

const makeStyles = (t: Theme) => ({
  root: { gap: space.xs },
  nav: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs },
  month: { flex: 1 },
  days: { flexDirection: 'row' as const },
  day: { flex: 1, alignItems: 'center' as const, gap: space.xs, paddingVertical: space.xs, borderRadius: radius.card },
  dayPressed: { backgroundColor: t.colors.accent },
  pill: {
    width: PILL,
    height: PILL,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillToday: { borderColor: t.colors.ring },
  pillSelected: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  mark: { width: MARK, height: MARK, borderRadius: radius.full, borderWidth: 1.5, borderColor: 'transparent' },
  markNone: { borderColor: t.colors.border },
  markPartial: { borderColor: t.colors.link },
  markFull: { borderColor: t.colors.link, backgroundColor: t.colors.link },
});

export interface WeekStripProps {
  week: LocalDate[];
  today: LocalDate;
  selected: LocalDate;
  marks: ReadonlyMap<LocalDate, PresenceMark>;
  onSelect: (date: LocalDate) => void;
  onShiftWeek: (delta: number) => void;
  onToday: () => void;
}

export function WeekStrip({ week, today, selected, marks, onSelect, onShiftWeek, onToday }: WeekStripProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const handlePrev = useCallback(() => onShiftWeek(-1), [onShiftWeek]);
  const handleNext = useCallback(() => onShiftWeek(1), [onShiftWeek]);

  const labels = useMemo(
    () =>
      week.map((date) => {
        const parts = [dayTitle(date, hijriOffset, names)];
        if (date === today) parts.push(t('practice.today'));
        const mark = marks.get(date);
        if (mark === 'full') parts.push(t('practice.hub.markFull'));
        if (mark === 'partial') parts.push(t('practice.hub.markPartial'));
        return parts.join(t('practice.hub.separator'));
      }),
    [week, today, marks, hijriOffset, names, t],
  );

  return (
    <View style={styles.root}>
      <View style={styles.nav}>
        <Text variant="small" tone="muted" style={styles.month}>
          {monthTitle(selected, names)}
        </Text>
        {selected !== today ? <Button label={t('practice.today')} onPress={onToday} variant="ghost" /> : null}
        <StepButton direction="back" label={t('practice.hub.previousWeek')} onPress={handlePrev} />
        <StepButton direction="forward" label={t('practice.hub.nextWeek')} onPress={handleNext} />
      </View>
      <View style={styles.days}>
        {week.map((date, i) => (
          <WeekDay
            key={date}
            date={date}
            letter={t(`practice.hub.weekdayShort.${weekday(date)}`)}
            label={labels[i]!}
            mark={date <= today ? (marks.get(date) ?? 'none') : undefined}
            isToday={date === today}
            isSelected={date === selected}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

interface WeekDayProps {
  date: LocalDate;
  letter: string;
  label: string;
  /** Undefined for a day still to come. */
  mark: PresenceMark | undefined;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: LocalDate) => void;
}

const WeekDay = memo(function WeekDay({ date, letter, label, mark, isToday, isSelected, onSelect }: WeekDayProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const handlePress = useCallback(() => onSelect(date), [onSelect, date]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      android_ripple={{ color: colors.accent, borderless: true, radius: 28 }}
      style={({ pressed }) => [styles.day, pressed && styles.dayPressed]}
    >
      <Text variant="caption" tone={isSelected ? 'link' : 'muted'} weight={isSelected ? 'medium' : 'regular'}>
        {letter}
      </Text>
      <View style={[styles.pill, isToday && styles.pillToday, isSelected && styles.pillSelected]}>
        <Text variant="body" weight={isToday || isSelected ? 'semibold' : 'regular'} tone={isSelected ? 'inverse' : 'default'}>
          {String(Number(date.slice(8, 10)))}
        </Text>
      </View>
      <View
        style={[
          styles.mark,
          mark === 'none' && styles.markNone,
          mark === 'partial' && styles.markPartial,
          mark === 'full' && styles.markFull,
        ]}
      />
    </Pressable>
  );
});
