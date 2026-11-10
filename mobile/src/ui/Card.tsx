/**
 * Surfaces after the website: the plain card (card fill, hairline, 14 radius, 16 padding), the pathway card
 * (the home doors: primary fill or quiet sage, each with its drawn plant), the next-step note (`.next-step`: sage fill, ring rule on the
 * start side), and a list row (`.topic-item`: icon, title, forward arrow, hairline below).
 */

import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Flourish } from './Flourish';
import { ForwardArrow, ForwardChevron, Icon } from './Icon';
import { Text } from './Text';

const makeStyles = (t: Theme) => ({
  card: {
    backgroundColor: t.colors.card,
    borderColor: t.colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  muted: { backgroundColor: t.colors.muted, borderColor: t.colors.muted },
  pressed: { backgroundColor: t.colors.accent },
  selected: { borderColor: t.colors.ring, backgroundColor: t.colors.muted },
  pathway: {
    borderRadius: radius.panel,
    borderWidth: 1,
    paddingTop: space['2xl'],
    paddingHorizontal: 22,
    paddingBottom: 22,
    overflow: 'hidden' as const,
  },
  pathwayHalf: { flex: 1, paddingTop: 19, paddingHorizontal: space.lg, paddingBottom: 17 },
  pathwayText: { flexGrow: 1, minWidth: 0, gap: space.md },
  pathwayTextHalf: { gap: space.sm },
  pathwayRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: 17,
  },
  pathwayPrimary: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  pathwayQuiet: { backgroundColor: t.colors.muted, borderColor: t.colors.border },
  pathwayPressed: { transform: [{ scale: 0.985 }] },
  pathwayLabel: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  pathwayTitle: { fontSize: 25, lineHeight: 40 },
  pathwayTitleHalf: { fontSize: 21, lineHeight: 34 },
  pathwayBody: { flexGrow: 1 },
  pathwayRowText: { flex: 1, gap: 2 },
  softInk: { opacity: 0.9 },
  /**
   * `.pathway-cta`: ONE action style on every door (owner round 5, A-17): a small card-filled pill with the brand ring
   * and a primary label with its arrow, the same on the filled door and on the quiet ones. The whole card is the
   * touch target; this is its visible sign.
   */
  pathwayCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: space.sm,
    minHeight: 36,
    paddingVertical: 5,
    paddingHorizontal: space.md,
    marginTop: space.xs,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: t.colors.ring,
    backgroundColor: t.colors.card,
    maxWidth: '100%' as const,
  },
  pathwayCtaRow: { alignSelf: 'center' as const, marginTop: 0, flexShrink: 0 },
  /** The plant in the bottom inline-end corner, behind the words and cut by the card's edge, as the website draws it. */
  artLayer: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    alignItems: 'flex-end' as const,
  },
  artInline: { position: 'relative' as const },
  sprigHalf: { marginBottom: -16, marginEnd: -18 },
  olive: { marginBottom: -16, marginEnd: -7 },
  oliveHalf: { marginBottom: -14, marginEnd: -6 },
  nextStep: {
    backgroundColor: t.colors.muted,
    borderStartWidth: 2,
    borderStartColor: t.colors.ring,
    paddingVertical: 17,
    paddingHorizontal: 22,
    borderTopEndRadius: 4,
    borderBottomEndRadius: 4,
    gap: space.xs,
  },
  listRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    minHeight: 64,
  },
  listRowLast: { borderBottomWidth: 0 },
  /** `minWidth: 0` lets a long title wrap inside the row instead of pushing the arrow off the screen edge. */
  listText: { flex: 1, minWidth: 0, gap: 2 },
  listValue: { maxWidth: '40%' as const, flexShrink: 0 },
  listEnd: { flexShrink: 0 },
});

export function Card({
  children,
  style,
  tone = 'default',
  onPress,
  selected,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'muted';
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const base = [styles.card, tone === 'muted' && styles.muted, selected && styles.selected, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [...base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export type PathwaySize = 'full' | 'half' | 'row';

export interface PathwayCardProps {
  icon: LucideIcon;
  /** The small overline beside the icon (`.pathway-overline`); hidden in the row size, as on the site. */
  label?: string;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
  primary?: boolean;
  /**
   * `full` (default): a door across the page; `half`: one of two doors side by side (the site's phone grid, smaller
   * type); `row`: the compact door (`.pathway-faith` at phone width: icon, words, action in one line).
   */
  size?: PathwaySize;
  /**
   * Screen-fitted sizes for a `full` door (home's `doorLayout`): title size, padding and the plant's square. Without
   * it the site's phone sizes apply.
   */
  layout?: { titleSize: number; titleLine: number; padding: number; art: number };
  style?: StyleProp<ViewStyle>;
}

/** The plant's reference size without a fitted layout (the site's phone size), and on a half door. */
const ART_DEFAULT = 76;
const ART_HALF = 56;

/**
 * The home doors («أعنّي على فعل طاعة» / «تخفَّف من معصية» / «شُعَب الإيمان»): a label with an icon, a title, a line and the
 * one door action. The line plant sits in the bottom inline-end corner, behind the words and cut by the card's edge,
 * as the website draws it (`Flourish`, absolute: the sprig on the filled door, the olive on the sage one). Owner round
 * 5 (A-17): «قبل لما كانت معمولة fit أحسن» — this restores that placement (commit c802b49) in place of the boxed plant.
 */
export function PathwayCard({ icon, label, title, body, action, onPress, primary, size = 'full', layout, style }: PathwayCardProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ink = primary ? 'inverse' : 'default';
  const soft = primary ? 'inverse' : 'muted';
  const row = size === 'row';
  const half = size === 'half';
  const fitted = size === 'full' && layout ? { padding: layout.padding, paddingTop: layout.padding + space.xs } : null;
  const art = half ? ART_HALF : (layout?.art ?? ART_DEFAULT);
  // The drawing is wider than its old square: the sprig about 1.5×, cut by the edge like the site's corner plant.
  const sprigWidth = half ? 76 : Math.round(art * 1.47);
  const cta = (
    <View style={[styles.pathwayCta, row && styles.pathwayCtaRow]}>
      <Text variant="caption" weight="medium" tone="link" numberOfLines={1}>
        {action}
      </Text>
      <ForwardArrow size={16} tone="link" />
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: primary ? colors.ring : colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}. ${action}`}
      style={({ pressed }) => [
        styles.pathway,
        half && styles.pathwayHalf,
        row && styles.pathwayRow,
        primary ? styles.pathwayPrimary : styles.pathwayQuiet,
        fitted,
        pressed && styles.pathwayPressed,
        style,
      ]}
    >
      {/* A layer over the card whose row ends at the inline end in either direction (flex follows the layout
          direction everywhere, absolute `end` does not on the web): the plant sits in that corner and bleeds out. */}
      {row ? null : (
        <View style={styles.artLayer} pointerEvents="none">
          {primary ? (
            <Flourish
              kind="sprig"
              width={sprigWidth}
              color={colors.pathwayFlourish}
              opacity={0.32}
              style={[styles.artInline, half ? styles.sprigHalf : { marginBottom: -Math.round(sprigWidth * 0.3), marginEnd: -14 }]}
            />
          ) : (
            <Flourish
              kind="olive"
              width={half ? 76 : Math.round(art * 1.18)}
              color={colors.ring}
              opacity={0.3}
              style={[styles.artInline, half ? styles.oliveHalf : styles.olive]}
            />
          )}
        </View>
      )}
      {row ? (
        <>
          <Icon icon={icon} size={28} tone={primary ? 'inverse' : 'link'} strokeWidth={1.35} />
          <View style={styles.pathwayRowText}>
            <Text variant="heading" tone={ink} numberOfLines={2}>
              {title}
            </Text>
            <Text variant="caption" tone={soft} numberOfLines={2} style={primary && styles.softInk}>
              {body}
            </Text>
          </View>
          {cta}
        </>
      ) : (
        <View style={[styles.pathwayText, half && styles.pathwayTextHalf]}>
          <View style={styles.pathwayLabel}>
            <Icon icon={icon} size={half ? 25 : 27} tone={primary ? 'inverse' : 'link'} strokeWidth={1.35} />
            {label ? (
              <Text variant="caption" tone={soft} style={primary && styles.softInk} numberOfLines={1}>
                {label}
              </Text>
            ) : null}
          </View>
          <Text
            variant="title"
            tone={ink}
            style={half ? styles.pathwayTitleHalf : layout ? { fontSize: layout.titleSize, lineHeight: layout.titleLine } : styles.pathwayTitle}
          >
            {title}
          </Text>
          <Text variant={half ? 'caption' : 'small'} tone={soft} style={[styles.pathwayBody, primary && styles.softInk]}>
            {body}
          </Text>
          {cta}
        </View>
      )}
    </Pressable>
  );
}

/** `.next-step`: a short guiding note («خربانة؟ صلّحها»). */
export function NextStep({ title, children }: { title?: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.nextStep}>
      {title ? (
        <Text variant="small" weight="semibold">
          {title}
        </Text>
      ) : null}
      {typeof children === 'string' ? <Text variant="small">{children}</Text> : children}
    </View>
  );
}

/** `.topic-item`: icon, title (and hint), forward arrow; hairline under it. */
export function ListRow({
  icon,
  leading,
  title,
  hint,
  onPress,
  trailing,
  chevron,
  value,
  destructive,
  ltrTitle,
  last,
}: {
  icon?: LucideIcon;
  /** A drawn mark in place of the icon (the profile mark on the account row). */
  leading?: React.ReactNode;
  title: string;
  hint?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  /** A chevron instead of the arrow (settings-like rows). */
  chevron?: boolean;
  /** A current value on the end, before the chevron or arrow (settings rows: «مفعّل», «0.1.0»). */
  value?: string;
  /** A destructive action (sign out, delete): title and icon in the destructive tone. */
  destructive?: boolean;
  /** An email, a code or a URL as the title: left to right on ONE line, cut in the middle when too long (A-26). */
  ltrTitle?: boolean;
  /** The list's last row: no hairline under it, so a section divider after the list is not doubled (A-05). */
  last?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const forward = onPress ? chevron ? <ForwardChevron size={18} tone="muted" /> : <ForwardArrow size={18} tone="muted" /> : null;
  const end = trailing ?? forward;
  const content = (
    <>
      {leading ?? (icon ? <Icon icon={icon} size={24} tone={destructive ? 'destructive' : 'link'} strokeWidth={1.3} /> : null)}
      <View style={styles.listText}>
        <Text
          variant="body"
          tone={destructive ? 'destructive' : undefined}
          numberOfLines={ltrTitle ? 1 : undefined}
          ellipsizeMode={ltrTitle ? 'middle' : undefined}
          style={ltrTitle ? { writingDirection: 'ltr' } : undefined}
        >
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="small" tone="muted" numberOfLines={1} style={styles.listValue}>
          {value}
        </Text>
      ) : null}
      {end ? <View style={styles.listEnd}>{end}</View> : null}
    </>
  );
  if (!onPress) return <View style={[styles.listRow, last && styles.listRowLast]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : undefined}
      android_ripple={{ color: colors.accent }}
      style={({ pressed }) => [styles.listRow, last && styles.listRowLast, pressed && { opacity: 0.7 }]}
    >
      {content}
    </Pressable>
  );
}
