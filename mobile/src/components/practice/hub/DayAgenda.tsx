/**
 * The hub's day list: «اليوم» or the selected date, then one row per agenda item (occasions, habits, relatives, the
 * private check-in last, in practice-core's order). Logging works for today and the 6 days before; other days are
 * view-only with a quiet note. When every task of the day is done, one hopeful line; nothing else celebrates.
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Eye, Leaf } from 'lucide-react-native';
import type { HabitItem, LocalDate, RelativeItem } from '@thekra/practice-core';
import type { AgendaRowModel, HubLastLog } from '@/lib/practice/use-habits-hub';
import { space, useStyles, type Theme } from '@/theme';
import { Notice, Text } from '@/ui';
import { HabitRow, OccasionRow, ProgramRow, RelativeRow, type UndoKind } from './AgendaRows';

const makeStyles = (t: Theme) => ({
  root: { gap: space.md },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
});

export interface DayAgendaProps {
  title: string;
  date: LocalDate;
  today: LocalDate;
  rows: AgendaRowModel[];
  canLog: boolean;
  complete: boolean;
  /** Nothing was started yet (the tracks below show how to begin). */
  started: boolean;
  lastLog: HubLastLog | null;
  onToggleHabit: (item: HabitItem) => void;
  onToggleRelative: (item: RelativeItem) => void;
  onUndo: () => void;
}

export function DayAgenda({
  title,
  date,
  today,
  rows,
  canLog,
  complete,
  started,
  lastLog,
  onToggleHabit,
  onToggleRelative,
  onUndo,
}: DayAgendaProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const future = date > today;
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

  const hasTasks = rows.some((r) => r.kind !== 'occasion');

  return (
    <View style={styles.root}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>

      {!canLog && rows.some((r) => r.kind === 'habit' || r.kind === 'relative') ? (
        <Notice icon={future ? CalendarClock : Eye}>{t(future ? 'practice.hub.futureNote' : 'practice.hub.pastNote')}</Notice>
      ) : null}

      {rows.length > 0 ? (
        <View style={styles.list}>
          {rows.map((row) => {
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
                return <ProgramRow key={row.key} done={row.done} meta={row.meta} />;
            }
          })}
        </View>
      ) : null}

      {/* A day can hold only a sunnah occasion: the empty line still says there is nothing to log. */}
      {hasTasks ? null : (
        <Text variant="small" tone="muted">
          {t(started ? 'practice.hub.dayEmpty' : 'practice.hub.dayEmptyStart')}
        </Text>
      )}

      {complete ? (
        <View accessibilityLiveRegion="polite">
          <Notice icon={Leaf}>{t(date === today ? 'practice.hub.dayDone' : 'practice.hub.dayDonePast')}</Notice>
        </View>
      ) : null}
    </View>
  );
}
