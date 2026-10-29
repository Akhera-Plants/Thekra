/**
 * Surfaces after the website: the plain card (card fill, hairline, 14 radius, 16 padding), the pathway card
 * (the home doors: primary fill or quiet sage), the next-step note (`.next-step`: sage fill, ring rule on the
 * start side), and a list row (`.topic-item`: icon, title, forward arrow, hairline below).
 */

import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
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
  pathwayPrimary: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  pathwayQuiet: { backgroundColor: t.colors.muted, borderColor: t.colors.border },
  pathwayLabel: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
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

/** The home doors («أعنّي على ترك معصية» / «… فعل طاعة»): a label with an icon, a title, a line, an action. */
export function PathwayCard({
  icon,
  label,
  title,
  body,
  action,
  onPress,
  primary,
  style,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
  primary?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const ink = primary ? 'inverse' : 'default';
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: primary ? colors.ring : colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      style={({ pressed }) => [styles.pathway, primary ? styles.pathwayPrimary : styles.pathwayQuiet, pressed && { transform: [{ scale: 0.985 }] }, style]}
    >
      <View style={styles.pathwayLabel}>
        <Icon icon={icon} size={26} tone={primary ? 'inverse' : 'link'} strokeWidth={1.3} />
        <Text variant="caption" tone={primary ? 'inverse' : 'muted'}>
          {label}
        </Text>
      </View>
      <Text variant="title" tone={ink} style={{ fontSize: 25, lineHeight: 40 }}>
        {title}
      </Text>
      <Text variant="small" tone={primary ? 'inverse' : 'muted'} style={{ opacity: primary ? 0.9 : 1 }}>
        {body}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: space.xs }}>
        <Text variant="small" weight="medium" tone={primary ? 'inverse' : 'link'}>
          {action}
        </Text>
        <ForwardArrow size={17} tone={primary ? 'inverse' : 'link'} />
      </View>
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
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  /** A chevron instead of the arrow (settings-like rows). */
  chevron?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? <Icon icon={icon} size={24} tone="link" strokeWidth={1.3} /> : null}
      <View style={styles.listText}>
        <Text variant="body">{title}</Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? chevron ? <ForwardChevron size={18} tone="muted" /> : <ForwardArrow size={18} tone="muted" /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: colors.accent }}
      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}
    >
      {content}
    </Pressable>
  );
}
