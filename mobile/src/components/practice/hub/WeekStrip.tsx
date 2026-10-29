/**
 * The hub's week strip, after the website's: the week of the selected day in reading order (Saturday first in
 * Arabic), each day a tall tile with its weekday, its number and a presence mark (empty ring / half / full; nothing
 * for days still to come). The selected day is a filled tile, today an outlined one. Above it the month, «اليوم» to
 * come back when another day is open, and previous / next week.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { weekday, type LocalDate } from '@thekra/practice-core';
import { dayTitle, monthTitle } from '@/lib/practice/calendar-grid';
import type { PresenceMark } from '@/lib/practice/hub';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, Text } from '@/ui';
import { StepButton } from './MonthGrid';
import { PresenceDot } from './PresenceDot';

const makeStyles = (t: Theme) => ({
  root: { gap: space.sm },
  nav: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs },
  month: { flex: 1 },
  days: { flexDirection: 'row' as const, gap: space.xs },
  day: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayToday: { borderColor: t.colors.ring },
  daySelected: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  dayPressed: { backgroundColor: t.colors.accent },
  number: { lineHeight: 22 },
  letterSelected: { opacity: 0.85 },
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
        <Text variant="body" weight="medium" style={styles.month} accessibilityRole="header">
          {monthTitle(selected, names)}
        </Text>
        {selected !== today ? <Button label={t('practice.today')} onPress={onToday} variant="outline" /> : null}
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
  const handlePress = useCallback(() => onSelect(date), [onSelect, date]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [
        styles.day,
        isToday && styles.dayToday,
        pressed && !isSelected && styles.dayPressed,
        isSelected && styles.daySelected,
      ]}
    >
      <Text variant="caption" tone={isSelected ? 'inverse' : 'muted'} style={isSelected && styles.letterSelected} maxFontSizeMultiplier={1.2}>
        {letter}
      </Text>
      <Text
        variant="body"
        weight={isToday || isSelected ? 'semibold' : 'medium'}
        tone={isSelected ? 'inverse' : 'default'}
        style={styles.number}
        maxFontSizeMultiplier={1.2}
      >
        {String(Number(date.slice(8, 10)))}
      </Text>
      <PresenceDot level={mark} inverted={isSelected} />
    </Pressable>
  );
});
