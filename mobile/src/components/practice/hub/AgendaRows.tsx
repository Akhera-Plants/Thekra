/**
 * Rows of the hub's day list, after the website's AgendaRows (hairline between rows, the lead at the reading start,
 * a forward arrow when the row opens a page):
 * - habit and relative: a round check (a checkbox named after the item: empty, half filled while only part of a
 *   habit is logged, filled with a tick when done; it settles with a small spring when ticked, still when the system
 *   asks to reduce motion) and the body that opens the plan / the kinship page, with «سُجِّل · تراجع» under the last
 *   quick log; for about 2 s after a habit's tick the catalog's short supplication («تقبّل الله منك») takes the place of
 *   «سُجِّل», fading in (instantly when the system asks to reduce motion); the habit chosen in «نيّتي اليوم» carries a
 *   small quiet mark;
 * - occasion: a sparkle on a soft gold disc and the title, opening its good deed;
 * - program: a neutral notebook on a quiet disc and generic words only, opening the private program.
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, HandHeart, NotebookPen, Sparkles, type LucideIcon } from 'lucide-react-native';
import type { HabitItem, RelativeItem } from '@thekra/practice-core';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { ForwardArrow, Icon, Text } from '@/ui';

const TARGET = 48;
const CHECK = 28;
const DISC = 40;
/** Where the undo line starts: under the row's words, past the lead. */
const UNDO_INDENT = TARGET + space.xs;

const makeStyles = (t: Theme) => ({
  row: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  line: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, minHeight: 56 },
  lead: { width: TARGET, height: TARGET, alignItems: 'center' as const, justifyContent: 'center' as const },
  body: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: TARGET,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.card,
  },
  bodyPressed: { backgroundColor: t.colors.accent },
  texts: { flex: 1, gap: 2 },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: t.colors.ring,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  checkHalf: { position: 'absolute' as const, start: 0, end: 0, bottom: 0, height: CHECK / 2 - 2, backgroundColor: t.colors.link },
  checkPartial: { borderColor: t.colors.link },
  checkOn: { borderColor: t.colors.primary, backgroundColor: t.colors.primary },
  checkLocked: { borderColor: t.colors.border },
  checkLockedState: { opacity: 0.6 },
  checkPressed: { transform: [{ scale: 0.9 }] },
  disc: { width: DISC, height: DISC, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const },
  discTint: { position: 'absolute' as const, top: 0, bottom: 0, start: 0, end: 0, opacity: 0.12 },
  discQuiet: { backgroundColor: t.colors.muted },
  undo: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingStart: UNDO_INDENT + space.sm },
  undoButton: { minHeight: 36, justifyContent: 'center' as const, paddingHorizontal: space.sm, borderRadius: radius.control },
  meta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
});

/** The tick settles with a short spring: the one moment on the page that answers the hand. */
function useTickSpring(checked: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasChecked = useRef(checked);
  useEffect(() => {
    const was = wasChecked.current;
    wasChecked.current = checked;
    if (!checked || was) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      scale.setValue(0.82);
      Animated.spring(scale, { toValue: 1, speed: 22, bounciness: 9, useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [checked, scale]);
  return scale;
}

interface CheckControlProps {
  label: string;
  checked: boolean;
  partial?: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** A round check with a 48 target: ring, half, or filled with a tick; a locked day shows its state, dimmed. */
function CheckControl({ label, checked, partial, disabled, onPress }: CheckControlProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const scale = useTickSpring(checked);
  const half = !checked && Boolean(partial);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: checked ? true : half ? 'mixed' : false, disabled }}
      android_ripple={{ color: colors.accent, borderless: true, radius: TARGET / 2 }}
      style={styles.lead}
    >
      {({ pressed }) => (
        <View style={pressed && styles.checkPressed}>
          <Animated.View
            style={[
              styles.check,
              half && styles.checkPartial,
              checked && styles.checkOn,
              disabled && !checked && !half && styles.checkLocked,
              disabled && (checked || half) && styles.checkLockedState,
              { transform: [{ scale }] },
            ]}
          >
            {half ? <View style={styles.checkHalf} /> : null}
            {checked ? <Icon icon={Check} size={16} tone="inverse" strokeWidth={2.6} /> : null}
          </Animated.View>
        </View>
      )}
    </Pressable>
  );
}

/** A small icon on a disc, for rows that open a page instead of being ticked. */
function IconLead({ icon, tone }: { icon: LucideIcon; tone: 'occasion' | 'quiet' }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.lead}>
      <View style={[styles.disc, tone === 'quiet' && styles.discQuiet]}>
        {tone === 'occasion' ? <View style={[styles.discTint, { backgroundColor: colors.intentGoodDeed }]} /> : null}
        <Icon icon={icon} size={18} color={tone === 'occasion' ? colors.intentGoodDeed : colors.mutedForeground} />
      </View>
    </View>
  );
}

interface RowBodyProps {
  title: string;
  /** A small quiet mark after the title, named for screen readers («نيّتي اليوم»). */
  mark?: string;
  /** Muted words after the title (a relative's relation). */
  titleNote?: string;
  meta: string;
  metaIcon?: LucideIcon;
  /** Done for the day: the title steps back. */
  settled?: boolean;
  /** Opens the item's page. */
  onPress: () => void;
}

function RowBody({ title, mark, titleNote, meta, metaIcon, settled, onPress }: RowBodyProps) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${titleNote ? ` · ${titleNote}` : ''}${mark ? ` · ${mark}` : ''}. ${meta}`}
      style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}
    >
      <View style={styles.texts}>
        <Text variant="body" weight="medium" tone={settled ? 'muted' : 'default'} numberOfLines={2}>
          {title}
          {titleNote ? (
            <Text variant="small" weight="regular" tone="muted">
              {` · ${titleNote}`}
            </Text>
          ) : null}
        </Text>
        <View style={styles.meta}>
          {mark ? <Icon icon={HandHeart} size={15} tone="link" strokeWidth={1.6} /> : null}
          {metaIcon ? <Icon icon={metaIcon} size={15} tone="link" /> : null}
          <Text variant="caption" tone={metaIcon ? 'link' : 'muted'} numberOfLines={2}>
            {meta}
          </Text>
        </View>
      </View>
      <ForwardArrow size={16} tone="muted" />
    </Pressable>
  );
}

/** What the last quick action did to a row: undo puts back what was there before it. */
export type UndoKind = 'logged' | 'cleared';

/** The supplication fades in over 180 ms; with reduce motion it simply appears. */
function useFadeIn(text: string | undefined) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
      opacity.setValue(1);
    };
  }, [text, opacity]);
  return opacity;
}

/** «سُجِّل · تراجع» after a tick (or the short supplication while it shows), «أُلغي التسجيل · تراجع» after an untick. */
function UndoLine({ kind, celebration, onUndo }: { kind: UndoKind; celebration?: string; onUndo: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const opacity = useFadeIn(celebration);
  return (
    <View style={styles.undo}>
      {celebration && kind === 'logged' ? (
        <Animated.View style={{ opacity }} accessibilityLiveRegion="polite">
          <Text variant="caption" weight="medium" tone="link">
            {celebration}
          </Text>
        </Animated.View>
      ) : (
        <Text variant="caption" tone="muted">
          {kind === 'cleared' ? t('practice.hub.unlogged') : t('practice.plan.logged')}
        </Text>
      )}
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        hitSlop={{ top: 6, bottom: 6 }}
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
  /** The habit chosen in «نيّتي اليوم» for this day. */
  intended?: boolean;
  /** The short supplication after this row's tick, while it shows. */
  celebration?: string;
  onToggle: (item: HabitItem) => void;
  onUndo: () => void;
}

export const HabitRow = memo(function HabitRow({ item, title, meta, canLog, undo, intended, celebration, onToggle, onUndo }: HabitRowProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const handleToggle = useCallback(() => onToggle(item), [onToggle, item]);
  const handleOpen = useCallback(() => router.push(`/practice/plan/${item.planId}`), [item.planId]);
  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <CheckControl label={title} checked={item.complete} partial={item.done > 0} disabled={!canLog} onPress={handleToggle} />
        <RowBody title={title} mark={intended ? t('tazkiya.niyyahMark') : undefined} meta={meta} settled={item.complete} onPress={handleOpen} />
      </View>
      {undo ? <UndoLine kind={undo} celebration={celebration} onUndo={onUndo} /> : null}
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
      <View style={styles.line}>
        <CheckControl label={name} checked={item.done} disabled={!canLog} onPress={handleToggle} />
        <RowBody title={name} titleNote={relation || undefined} meta={meta} settled={item.done} onPress={openKinship} />
      </View>
      {undo ? <UndoLine kind={undo} onUndo={onUndo} /> : null}
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
      <View style={styles.line}>
        <IconLead icon={Sparkles} tone="occasion" />
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
      <View style={styles.line}>
        <IconLead icon={NotebookPen} tone="quiet" />
        <RowBody title={t('practice.hub.programTitle')} meta={meta} metaIcon={done ? Check : undefined} settled={done} onPress={openProgram} />
      </View>
    </View>
  );
});
