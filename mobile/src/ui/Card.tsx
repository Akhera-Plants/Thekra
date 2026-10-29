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
    gap: space.md,
    overflow: 'hidden' as const,
  },
  pathwayHalf: { flex: 1, paddingTop: 19, paddingHorizontal: space.lg, paddingBottom: 17, gap: space.sm },
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
  pathwayCtaQuiet: { borderColor: t.colors.ring },
  /** `.pathway-flourish` and `.olive-drawing` placements, desktop and phone (site-public.css). */
  sprig: { bottom: -74, end: -24 },
  sprigHalf: { bottom: -16, end: -18 },
  olive: { bottom: -16, end: -7 },
  oliveHalf: { bottom: -14, end: -6 },
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
  style?: StyleProp<ViewStyle>;
}

/**
 * The home doors («أعنّي على ترك معصية» / «… فعل طاعة»): a label with an icon, a title, a line and the site's small
 * outlined action, with a line plant in the end corner (`Flourish`: the sprig on the filled door, the olive on the
 * sage one) drawn behind the words.
 */
export function PathwayCard({ icon, label, title, body, action, onPress, primary, size = 'full', style }: PathwayCardProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ink = primary ? 'inverse' : 'default';
  const soft = primary ? 'inverse' : 'muted';
  const row = size === 'row';
  const cta = (
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
        size === 'half' && styles.pathwayHalf,
        row && styles.pathwayRow,
        primary ? styles.pathwayPrimary : styles.pathwayQuiet,
        pressed && styles.pathwayPressed,
        style,
      ]}
    >
      {row ? null : primary ? (
        <Flourish
          kind="sprig"
          width={size === 'half' ? 76 : 145}
          color={colors.pathwayFlourish}
          opacity={0.1}
          style={size === 'half' ? styles.sprigHalf : styles.sprig}
        />
      ) : (
        <Flourish
          kind="olive"
          width={size === 'half' ? 76 : 90}
          color={colors.ring}
          opacity={0.25}
          style={size === 'half' ? styles.oliveHalf : styles.olive}
        />
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
        <>
          <View style={styles.pathwayLabel}>
            <Icon icon={icon} size={size === 'half' ? 25 : 27} tone={primary ? 'inverse' : 'link'} strokeWidth={1.35} />
            {label ? (
              <Text variant="caption" tone={soft} style={primary && styles.softInk} numberOfLines={1}>
                {label}
              </Text>
            ) : null}
          </View>
          <Text variant="title" tone={ink} style={size === 'half' ? styles.pathwayTitleHalf : styles.pathwayTitle}>
            {title}
          </Text>
          <Text variant={size === 'half' ? 'caption' : 'small'} tone={soft} style={[styles.pathwayBody, primary && styles.softInk]}>
            {body}
          </Text>
          {cta}
        </>
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
