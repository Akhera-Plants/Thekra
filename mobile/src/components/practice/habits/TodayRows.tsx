/**
 * A habit row of «اليوم» (owner round 6, C-02a; the reference's row, our kit): the round check (logs what is left),
 * the title and one short line, opening the habit page; for a counted habit asked for more than one unit the
 * reference's inline counter «2 / 4» with «+» (one unit a tap, hub-view `hasCounter`). Under the row, only when they
 * apply: «صلّحها» (the gap context: a missed day, practice-core `makeUpOffer`) and «القدر الأدنى» (after a missed
 * day), or «سُجِّل · تراجع» after the last quick log.
 */

import React, { memo, useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import type { HabitItem, PlanUnit } from '@thekra/practice-core';
import { hasCounter } from '@/lib/practice/hub-view';
import { space, useStyles, type Theme } from '@/theme';
import { Button, IconButton, Text } from '@/ui';
import { CheckControl, RowBody, UndoLine, type UndoKind } from '@/components/practice/hub/AgendaRows';

const makeStyles = (t: Theme) => ({
  row: { paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  last: { borderBottomWidth: 0 },
  line: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, minHeight: 56 },
  settled: { opacity: 0.55 },
  body: { flex: 1, minWidth: 0 },
  counter: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
  count: { fontVariant: ['tabular-nums' as const], minWidth: 36, textAlign: 'center' as const },
  under: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: space.sm, paddingStart: 52 },
});

export interface TodayHabitRowProps {
  item: HabitItem;
  unit: PlanUnit;
  title: string;
  meta: string;
  canLog: boolean;
  undo: UndoKind | null;
  last?: boolean;
  onToggle: (item: HabitItem) => void;
  onAddOne: (item: HabitItem) => void;
  onUndo: () => void;
  onMinimum?: (item: HabitItem) => void;
  onFix?: (item: HabitItem) => void;
}

export const TodayHabitRow = memo(function TodayHabitRow({
  item,
  unit,
  title,
  meta,
  canLog,
  undo,
  last,
  onToggle,
  onAddOne,
  onUndo,
  onMinimum,
  onFix,
}: TodayHabitRowProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const counter = hasCounter(unit, item.required);
  const open = useCallback(() => router.push(`/practice/plan/${item.planId}`), [item.planId]);
  return (
    <View style={[styles.row, last && styles.last]}>
      <View style={[styles.line, item.complete && styles.settled]}>
        <CheckControl label={title} checked={item.complete} partial={item.done > 0} disabled={!canLog} onPress={() => onToggle(item)} />
        <View style={styles.body}>
          <RowBody title={title} meta={meta} settled={item.complete} onPress={open} />
        </View>
        {counter ? (
          <View style={styles.counter}>
            <Text variant="small" tone="muted" style={styles.count} accessibilityLabel={t('habitsHub.today.counterLabel', { done: item.done, required: item.required })}>
              {`${item.done} / ${item.required}`}
            </Text>
            <IconButton icon={Plus} label={t('habitsHub.today.addOne', { habit: title })} onPress={() => onAddOne(item)} disabled={!canLog} bordered />
          </View>
        ) : null}
      </View>
      {undo ? (
        <UndoLine kind={undo} onUndo={onUndo} />
      ) : onMinimum || onFix ? (
        <View style={styles.under}>
          {onFix ? <Button label={t('myHabits.fix')} onPress={() => onFix(item)} variant="outline" size="sm" accessibilityLabel={`${t('myHabits.fix')}: ${title}`} /> : null}
          {onMinimum ? <Button label={t('habitsHub.today.minimum')} onPress={() => onMinimum(item)} variant="outline" size="sm" /> : null}
        </View>
      ) : null}
    </View>
  );
});
