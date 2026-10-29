/**
 * Rows of the hub's day list, after the website's topic rows (hairline under each, the lead at the reading start, a
 * forward chevron when the row opens a page):
 * - habit and relative: a round check (a checkbox named after the item; «mixed» while only part of a habit is logged)
 *   and the body that opens the plan / the kinship page, with «سُجِّل · تراجع» under the last quick log;
 * - occasion: a sparkle and the title, opening its good deed;
 * - program: a neutral notebook and generic words only, opening the private program.
 */

import React, { memo, useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, NotebookPen, Sparkles, type LucideIcon } from 'lucide-react-native';
import type { HabitItem, RelativeItem } from '@thekra/practice-core';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { ForwardChevron, Icon, Text } from '@/ui';

const CHECK = 28;

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    minHeight: 64,
  },
  lead: { width: 48, height: 48, alignItems: 'center' as const, justifyContent: 'center' as const },
  column: { flex: 1 },
  body: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 48, paddingVertical: space.xs },
  bodyPressed: { opacity: 0.7 },
  texts: { flex: 1, gap: 2 },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: t.colors.mutedForeground,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checkPartial: { borderColor: t.colors.link, backgroundColor: t.colors.primarySoft },
  checkOn: { borderColor: t.colors.primary, backgroundColor: t.colors.primary },
  checkOff: { opacity: 0.4 },
  undo: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingBottom: space.xs },
  undoButton: { minHeight: 32, justifyContent: 'center' as const, paddingHorizontal: space.xs },
  doneMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
});

interface CheckControlProps {
  label: string;
  checked: boolean;
  partial?: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** A round check with a 48 target. */
function CheckControl({ label, checked, partial, disabled, onPress }: CheckControlProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: checked ? true : partial ? 'mixed' : false, disabled }}
      android_ripple={{ color: colors.accent, borderless: true, radius: 24 }}
      style={styles.lead}
    >
      <View style={[styles.check, partial && styles.checkPartial, checked && styles.checkOn, disabled && styles.checkOff]}>
        {checked ? <Icon icon={Check} size={16} tone="inverse" strokeWidth={2.2} /> : null}
      </View>
    </Pressable>
  );
}

interface RowBodyProps {
  title: string;
  /** Muted words after the title (a relative's relation). */
  titleNote?: string;
  meta: string;
  metaIcon?: LucideIcon;
  /** Opens the item's page. */
  onPress: () => void;
}

function RowBody({ title, titleNote, meta, metaIcon, onPress }: RowBodyProps) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${titleNote ? ` · ${titleNote}` : ''}. ${meta}`}
      style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}
    >
      <View style={styles.texts}>
        <Text variant="body" weight="medium" numberOfLines={2}>
          {title}
          {titleNote ? (
            <Text variant="small" tone="muted">
              {` · ${titleNote}`}
            </Text>
          ) : null}
        </Text>
        <View style={styles.doneMeta}>
          {metaIcon ? <Icon icon={metaIcon} size={15} tone="link" /> : null}
          <Text variant="caption" tone={metaIcon ? 'link' : 'muted'} numberOfLines={2}>
            {meta}
          </Text>
        </View>
      </View>
      <ForwardChevron size={18} tone="muted" />
    </Pressable>
  );
}

/** What the last quick action did to a row: undo puts back what was there before it. */
export type UndoKind = 'logged' | 'cleared';

/** «سُجِّل · تراجع» after a tick, «أُلغي التسجيل · تراجع» after an untick. */
function UndoLine({ kind, onUndo }: { kind: UndoKind; onUndo: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.undo}>
      <Text variant="caption" tone="muted">
        {kind === 'cleared' ? t('practice.hub.unlogged') : t('practice.plan.logged')}
      </Text>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.undoButton, pressed && styles.bodyPressed]}
      >
        <Text variant="caption" weight="medium" tone="link">
          {t('practice.plan.undo')}
        </Text>
      </Pressable>
    </View>
  );
}

export interface HabitRowProps {
  item: HabitItem;
  title: string;
  meta: string;
  canLog: boolean;
  undo: UndoKind | null;
  onToggle: (item: HabitItem) => void;
  onUndo: () => void;
}

export const HabitRow = memo(function HabitRow({ item, title, meta, canLog, undo, onToggle, onUndo }: HabitRowProps) {
  const styles = useStyles(makeStyles);
  const handleToggle = useCallback(() => onToggle(item), [onToggle, item]);
  const handleOpen = useCallback(() => router.push(`/practice/plan/${item.planId}`), [item.planId]);
  return (
    <View style={styles.row}>
      <CheckControl label={title} checked={item.complete} partial={item.done > 0} disabled={!canLog} onPress={handleToggle} />
      <View style={styles.column}>
        <RowBody title={title} meta={meta} onPress={handleOpen} />
        {undo ? <UndoLine kind={undo} onUndo={onUndo} /> : null}
      </View>
    </View>
  );
});

export interface RelativeRowProps {
  item: RelativeItem;
  name: string;
  relation: string;
  meta: string;
  canLog: boolean;
  undo: UndoKind | null;
  onToggle: (item: RelativeItem) => void;
  onUndo: () => void;
}

const openKinship = () => router.push('/practice/kinship');

export const RelativeRow = memo(function RelativeRow({ item, name, relation, meta, canLog, undo, onToggle, onUndo }: RelativeRowProps) {
  const styles = useStyles(makeStyles);
  const handleToggle = useCallback(() => onToggle(item), [onToggle, item]);
  return (
    <View style={styles.row}>
      <CheckControl label={name} checked={item.done} disabled={!canLog} onPress={handleToggle} />
      <View style={styles.column}>
        <RowBody title={name} titleNote={relation || undefined} meta={meta} onPress={openKinship} />
        {undo ? <UndoLine kind={undo} onUndo={onUndo} /> : null}
      </View>
    </View>
  );
});

export interface OccasionRowProps {
  title: string;
  deed: string;
}

export const OccasionRow = memo(function OccasionRow({ title, deed }: OccasionRowProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const handleOpen = useCallback(() => router.push(`/good-deeds/${deed}`), [deed]);
  return (
    <View style={styles.row}>
      <View style={styles.lead}>
        <Icon icon={Sparkles} size={22} tone="link" />
      </View>
      <View style={styles.column}>
        <RowBody title={title} meta={t('practice.hub.occasionTag')} onPress={handleOpen} />
      </View>
    </View>
  );
});

const openProgram = () => router.push('/practice/sin-program');

/** The private program, generic on purpose: no name, a neutral notebook, «تذكرة من ذكرى». */
export const ProgramRow = memo(function ProgramRow({ done, meta }: { done: boolean; meta: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.lead}>
        <Icon icon={NotebookPen} size={22} tone={done ? 'muted' : 'link'} />
      </View>
      <View style={styles.column}>
        <RowBody title={t('practice.hub.programTitle')} meta={meta} metaIcon={done ? Check : undefined} onPress={openProgram} />
      </View>
    </View>
  );
});
