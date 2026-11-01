/**
 * Rows of «عاداتي» (owner, 2026-11-01): a habit row opens its plan and ends in the action that fits today
 * (`DayAction`); a «تخفَّف» row shows the program's stage and days held, opens the (locked) program screen, and ends
 * in «سجّل» (today's check-in is there) or «تمّ». The body and the action are siblings, so a screen reader reaches both. Program rows carry
 * generic words only (see `my-habits.ts`).
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react-native';
import type { HabitDayAction, ProgramRowModel } from '@/lib/practice/my-habits';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, ForwardChevron, Icon, Text } from '@/ui';
import { DayAction } from './DayAction';

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 68,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  body: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, paddingVertical: space.sm, minWidth: 0 },
  bodyPressed: { opacity: 0.7 },
  texts: { flex: 1, gap: 2, minWidth: 0 },
  undoLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingStart: 24 + space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  framed: { borderBottomWidth: 0 },
});

interface RowFrameProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  onOpen: () => void;
  /** The trailing action; a chevron when there is none. */
  action?: React.ReactNode;
  settled?: boolean;
  /** A line under the row that shares its hairline (the undo after a log). */
  below?: React.ReactNode;
}

function RowFrame({ icon, title, hint, onOpen, action, settled, below }: RowFrameProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <>
    <View style={[styles.row, below ? styles.framed : null]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={hint ? `${title}. ${hint}` : title}
        android_ripple={{ color: colors.accent }}
        style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}
      >
        <Icon icon={icon} size={24} tone="link" strokeWidth={1.3} />
        <View style={styles.texts}>
          <Text variant="body" tone={settled ? 'muted' : undefined} numberOfLines={2}>
            {title}
          </Text>
          {hint ? (
            <Text variant="caption" tone="muted" numberOfLines={3}>
              {hint}
            </Text>
          ) : null}
        </View>
        {action ? null : <ForwardChevron size={18} tone="muted" />}
      </Pressable>
      {action}
    </View>
    {below ? <View style={styles.undoLine}>{below}</View> : null}
    </>
  );
}

export interface HabitActionRowProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action: HabitDayAction | null;
  onOpen: () => void;
  onAction: () => void;
  /** Right after a log or its undo from this row: «سُجِّل · تراجع» / «أُلغي التسجيل · تراجع». */
  undo?: { cleared: boolean; onUndo: () => void } | null;
}

/** A habit: the row opens the plan; the button logs today, takes it back, or resumes a paused habit. */
export function HabitActionRow({ icon, title, hint, action, onOpen, onAction, undo }: HabitActionRowProps) {
  const { t } = useTranslation();
  return (
    <RowFrame
      icon={icon}
      title={title}
      hint={hint}
      onOpen={onOpen}
      settled={action === 'done'}
      below={
        undo ? (
          <>
            <Text variant="caption" tone="muted">
              {undo.cleared ? t('practice.hub.unlogged') : t('practice.plan.logged')}
            </Text>
            <Button label={t('practice.plan.undo')} onPress={undo.onUndo} variant="ghost" compact />
          </>
        ) : undefined
      }
      action={action ? <DayAction action={action} subject={title} onPress={onAction} doneHint={t('myHabits.doneHint')} /> : undefined}
    />
  );
}

export interface ProgramActionRowProps {
  icon: LucideIcon;
  model: ProgramRowModel;
  /** «برنامجك», or «البرنامج 2» when several run. */
  title: string;
  /** The current stage's title from the catalog (common to every sin), when known. */
  stageTitle?: string;
  onOpen: () => void;
}

/** A «تخفَّف» program: the stage and the days held; the row and its button open the locked program screen. */
export function ProgramActionRow({ icon, model, title, stageTitle, onOpen }: ProgramActionRowProps) {
  const { t } = useTranslation();
  const stage = t('sinProgram.stage', { n: String(model.stage), total: String(model.stages) });
  const held = t('sinProgram.counters.held', { n: String(model.held), total: String(model.window) });
  // Two short lines: where the program is, and how it is going.
  const hint = `${stageTitle ? `${stage}: ${stageTitle}` : stage}\n${held}`;
  return (
    <RowFrame
      icon={icon}
      title={title}
      hint={hint}
      onOpen={onOpen}
      action={
        <DayAction action={model.checkedIn ? 'done' : 'log'} subject={title} onPress={onOpen} />
      }
    />
  );
}
