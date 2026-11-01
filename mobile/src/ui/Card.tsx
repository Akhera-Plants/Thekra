/**
 * Surfaces after the website: the plain card (card fill, hairline, 14 radius, 16 padding), the pathway card
 * (the home doors: primary fill or quiet sage, each with its drawn plant), the next-step note (`.next-step`: sage fill, ring rule on the
 * start side), and a list row (`.topic-item`: icon, title, forward arrow, hairline below).
 */

import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Flourish } from './Decor';
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
  /** Words on the inline-start side, the plant whole in its own square at the bottom inline-end corner. */
  pathwayInner: { flexGrow: 1, flexDirection: 'row' as const, alignItems: 'stretch' as const, gap: space.md },
  pathwayText: { flex: 1, minWidth: 0, gap: space.md },
  pathwayTextHalf: { gap: space.sm },
  pathwayArt: { justifyContent: 'flex-end' as const, alignItems: 'flex-end' as const },
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
  /** `.pathway-cta`: a small outlined action, primary-ink on the filled door, the brand ring on the quiet ones. */
  pathwayCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: space.md,
    minHeight: 34,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: space.xs,
    borderRadius: radius.control,
    borderWidth: 1,
    maxWidth: '100%' as const,
  },
  pathwayCtaRow: { alignSelf: 'center' as const, marginTop: 0, gap: space.sm, maxWidth: undefined },
  pathwayCtaPrimary: { borderColor: t.colors.pathwayFlourish },
  pathwayCtaQuiet: { borderColor: t.colors.ring, backgroundColor: t.colors.card },
  /** The compact door's action on phones: a framed arrow, so it still reads as a button. */
  pathwayArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
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
  listText: { flex: 1, gap: 2 },
  listValue: { maxWidth: '45%' as const },
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
  /** `row` only: the action as a bare arrow (small phones, so the words keep their room). */
  arrowOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The plant's square without a fitted layout (the site's phone size), and on a half door. */
const ART_DEFAULT = 76;
const ART_HALF = 56;

/**
 * The home doors («أعنّي على فعل طاعة» / «تخفَّف من معصية»): a label with an icon, a title, a line and the site's
 * small outlined action on the inline-start side, and a line plant in its own square at the bottom inline-end corner
 * (`Flourish`, contained: the sprig on the filled door, the olive on the sage one). The plant is drawn whole and never
 * under the words, at the same place on every door and every screen size (owner, 2026-11-01).
 */
export function PathwayCard({ icon, label, title, body, action, onPress, primary, size = 'full', layout, arrowOnly, style }: PathwayCardProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ink = primary ? 'inverse' : 'default';
  const soft = primary ? 'inverse' : 'muted';
  const row = size === 'row';
  const half = size === 'half';
  const fitted = size === 'full' && layout ? { padding: layout.padding, paddingTop: layout.padding + space.xs } : null;
  const art = half ? ART_HALF : (layout?.art ?? ART_DEFAULT);
  const cta = row && arrowOnly ? (
    <View style={[styles.pathwayArrow, { borderColor: primary ? colors.pathwayFlourish : colors.ring }]}>
      <ForwardArrow size={18} tone={primary ? 'inverse' : 'link'} />
    </View>
  ) : (
    <View style={[styles.pathwayCta, primary ? styles.pathwayCtaPrimary : styles.pathwayCtaQuiet, row && styles.pathwayCtaRow]}>
      <Text variant="caption" weight="medium" tone={primary ? 'inverse' : 'link'} numberOfLines={1}>
        {action}
      </Text>
      <ForwardArrow size={16} tone={primary ? 'inverse' : 'link'} />
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
        <View style={styles.pathwayInner}>
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
          <View style={[styles.pathwayArt, { width: art }]}>
            <Flourish
              contained
              kind={primary ? 'sprig' : 'olive'}
              width={art}
              color={primary ? colors.pathwayFlourish : colors.ring}
              opacity={primary ? 0.6 : 0.55}
            />
          </View>
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
  title,
  hint,
  onPress,
  trailing,
  chevron,
  value,
  destructive,
}: {
  icon?: LucideIcon;
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
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const forward = onPress ? chevron ? <ForwardChevron size={18} tone="muted" /> : <ForwardArrow size={18} tone="muted" /> : null;
  const content = (
    <>
      {icon ? <Icon icon={icon} size={24} tone={destructive ? 'destructive' : 'link'} strokeWidth={1.3} /> : null}
      <View style={styles.listText}>
        <Text variant="body" tone={destructive ? 'destructive' : undefined}>
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
      {trailing ?? forward}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : undefined}
      android_ripple={{ color: colors.accent }}
      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}
    >
      {content}
    </Pressable>
  );
}
