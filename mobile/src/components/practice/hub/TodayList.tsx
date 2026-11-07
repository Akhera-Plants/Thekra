/**
 * A day's list: «اليوم» on «ورد اليوم», or a day picked in «سجلّي». Today's sunnah occasion as one compact line, then
 * one row per task (habits, relatives as periodic acts, the generic private check-in), open ones first and done ones
 * sunk to the bottom, dimmed (`groupTodayRows`). Habits the day does not ask for sit in ONE collapsed row
 * «ليست مطلوبة اليوم (n)» that opens to loggable rows, never counted as missed. With no task: one line and an outlined «أضف عادة».
 * Logging works for today and the 6 days before; another day shows a quiet note and its state only.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ChevronDown, ChevronUp, Eye, Plus } from 'lucide-react-native';
import type { HabitItem, LocalDate, RelativeItem } from '@thekra/practice-core';
import type { HubLastLog } from '@/lib/practice/use-habits-hub';
import { groupTodayRows, type AgendaRowModel } from '@/lib/practice/wird';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, Icon, Notice, Text } from '@/ui';
import { HabitRow, OccasionRow, ProgramRow, RelativeRow, type UndoKind } from './AgendaRows';

const makeStyles = (t: Theme) => ({
  root: { gap: space.md },
  /** No top rule: the first row sits under its section title (A-05). */
  list: {},
  empty: { gap: space.xs, alignItems: 'flex-start' as const },
  toggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  togglePressed: { backgroundColor: t.colors.accent, borderRadius: radius.control },
  toggleText: { flex: 1 },
});

export interface TodayListProps {
  title: string;
  date: LocalDate;
  today: LocalDate;
  rows: AgendaRowModel[];
  /** Habit rows of plans this day does not ask for: behind the collapsed row, still loggable. */
  offDayRows: AgendaRowModel[];
  canLog: boolean;
  lastLog: HubLastLog | null;
  onToggleHabit: (item: HabitItem) => void;
  onToggleRelative: (item: RelativeItem) => void;
  onUndo: () => void;
  /** «أقل ما يمكن» on a habit row (today's list). */
  onMinimum?: (item: HabitItem) => void;
  /** «أضف عادة» under the empty line (on «ورد اليوم» only). */
  onAddHabit?: () => void;
  /** Under the list (the «يومي ثقيل» chip). */
  footer?: React.ReactNode;
}

export function TodayList({
  title,
  date,
  today,
  rows,
  offDayRows,
  canLog,
  lastLog,
  onToggleHabit,
  onToggleRelative,
  onUndo,
  onMinimum,
  onAddHabit,
  footer,
}: TodayListProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [offDayOpen, setOffDayOpen] = useState(false);
  const toggleOffDay = useCallback(() => setOffDayOpen((open) => !open), []);
  const groups = useMemo(() => groupTodayRows(rows), [rows]);
  const isToday = date === today;
  const tasks = [...groups.open, ...groups.done];

  /** The row's inline undo: 'logged' after a tick, 'cleared' after an untick, null when the row has none. */
  const undoFor = (kind: HubLastLog['kind'], id: string): UndoKind | null =>
    lastLog !== null &&
    lastLog.date === date &&
    lastLog.kind === kind &&
    (lastLog.kind === 'habit' ? lastLog.planId : lastLog.relativeId) === id
      ? lastLog.cleared
        ? 'cleared'
        : 'logged'
      : null;

  const renderRow = (row: AgendaRowModel) => {
    switch (row.kind) {
      case 'occasion':
        return <OccasionRow key={row.key} title={row.title} deed={row.deed} />;
      case 'habit':
        return (
          <HabitRow
            key={row.key}
            item={row.item}
            title={row.title}
            meta={row.meta}
            canLog={canLog}
            undo={undoFor('habit', row.item.planId)}
            onToggle={onToggleHabit}
            onUndo={onUndo}
            onMinimum={canLog && row.canMinimum ? onMinimum : undefined}
          />
        );
      case 'relative':
        return (
          <RelativeRow
            key={row.key}
            item={row.item}
            name={row.title}
            relation={row.relation}
            meta={row.meta}
            canLog={canLog}
            undo={undoFor('relative', row.item.relativeId)}
            onToggle={onToggleRelative}
            onUndo={onUndo}
          />
        );
      case 'program':
        return <ProgramRow key={row.key} done={row.done} meta={row.meta} showMoment={isToday} />;
    }
  };

  const offDayLabel = t(isToday ? 'practice.wird.notDueToday' : 'practice.wird.notDueDay', { count: offDayRows.length });

  return (
    <View style={styles.root}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>

      {!canLog && (tasks.length > 0 || offDayRows.length > 0) ? (
        <Notice icon={date > today ? CalendarClock : Eye}>
          {t(date > today ? 'practice.hub.futureNote' : 'practice.hub.pastNote')}
        </Notice>
      ) : null}

      {groups.occasions.length > 0 ? <View>{groups.occasions.map(renderRow)}</View> : null}

      {tasks.length > 0 ? (
        <View style={styles.list}>{tasks.map(renderRow)}</View>
      ) : (
        <View style={styles.empty}>
          <Text variant="body" tone="muted">
            {t(isToday ? 'practice.wird.empty' : 'practice.hub.dayEmpty')}
          </Text>
          {onAddHabit ? <Button label={t('practice.addHabit')} icon={Plus} variant="outline" onPress={onAddHabit} /> : null}
        </View>
      )}

      {offDayRows.length > 0 ? (
        <View>
          <Pressable
            onPress={toggleOffDay}
            accessibilityRole="button"
            accessibilityState={{ expanded: offDayOpen }}
            style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
          >
            <Text variant="small" weight="medium" tone="muted" style={styles.toggleText}>
              {offDayLabel}
            </Text>
            <Icon icon={offDayOpen ? ChevronUp : ChevronDown} size={18} tone="muted" />
          </Pressable>
          {offDayOpen ? <View>{offDayRows.map(renderRow)}</View> : null}
        </View>
      ) : null}

      {footer}
    </View>
  );
}
