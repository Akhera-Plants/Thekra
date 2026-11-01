/**
 * Buttons after site-public.css: `.solid-button` (primary fill), `.outline-button` (card fill, hairline, primary
 * label), `.text-link` (primary label with a forward arrow, framed), plus a quiet one and a destructive one.
 * 7 radius, 43 minimum height, 8×17 padding, 14 medium label, 13 gap to the icon.
 * Every action has a visible frame (owner, 2026-11-01: «لا تترك زرًّا بلا إطار»): the quiet `ghost` is an outline
 * with no fill and an ink label, a step below `outline`; `TextLink` is a small outlined link.
 */

import React from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { ForwardArrow, Icon } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'destructive';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Leading icon. */
  icon?: LucideIcon;
  /** A forward arrow after the label (the site's call-to-action buttons). */
  arrow?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Full width. */
  block?: boolean;
  /** Larger primary action (17 label, 47 high: the site's form «التالي»). */
  large?: boolean;
  /** A small inline action (36 high, 48 with the hit slop): «تراجع» beside a line. */
  compact?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const makeStyles = (t: Theme) => ({
  base: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 13,
    minHeight: 43,
    paddingVertical: space.sm,
    paddingHorizontal: 17,
    borderRadius: radius.control,
    borderWidth: 1,
    alignSelf: 'flex-start' as const,
  },
  large: { minHeight: 47 },
  compact: { minHeight: 36, paddingVertical: 4, paddingHorizontal: space.md, gap: space.sm },
  block: { alignSelf: 'stretch' as const },
  solid: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  outline: { backgroundColor: t.colors.card, borderColor: t.colors.border },
  outlinePressed: { backgroundColor: t.colors.muted, borderColor: t.colors.ring },
  ghost: { backgroundColor: 'transparent', borderColor: t.colors.border },
  ghostPressed: { backgroundColor: t.colors.accent, borderColor: t.colors.ring },
  destructive: { backgroundColor: t.colors.card, borderColor: t.colors.destructive },
  disabled: { opacity: 0.45 },
  textLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 40,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
    alignSelf: 'flex-start' as const,
  },
  textLinkPressed: { backgroundColor: t.colors.muted, borderColor: t.colors.ring },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.full,
  },
});

export function Button({
  label,
  onPress,
  variant = 'solid',
  icon,
  arrow,
  disabled,
  loading,
  block,
  large,
  compact,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const tone = variant === 'solid' ? 'inverse' : variant === 'destructive' ? 'destructive' : variant === 'ghost' ? 'default' : 'link';
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      hitSlop={compact ? { top: 6, bottom: 6 } : { top: 3, bottom: 3 }}
      android_ripple={{ color: variant === 'solid' ? colors.ring : colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        large && styles.large,
        compact && styles.compact,
        block && styles.block,
        pressed && variant === 'solid' && { opacity: 0.88 },
        pressed && variant === 'outline' && styles.outlinePressed,
        pressed && variant === 'ghost' && styles.ghostPressed,
        pressed && variant === 'destructive' && { opacity: 0.8 },
        off && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'solid' ? colors.primaryForeground : colors.primary} />
      ) : icon ? (
        <Icon icon={icon} size={17} tone={tone} />
      ) : null}
      <Text variant={large ? 'body' : 'small'} weight={large ? 'regular' : 'medium'} tone={tone}>
        {label}
      </Text>
      {arrow ? <ForwardArrow size={17} tone={tone} /> : null}
    </Pressable>
  );
}

/** `.text-link`: a primary label with a forward arrow, in a hairline frame so it reads as a control. */
export function TextLink({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.textLink, pressed && styles.textLinkPressed]}
      hitSlop={{ top: 4, bottom: 4 }}
    >
      <Text variant="small" weight="medium" tone={muted ? 'muted' : 'link'}>
        {label}
      </Text>
      <ForwardArrow size={17} tone={muted ? 'muted' : 'link'} />
    </Pressable>
  );
}

/** A round 48×48 icon button (share, favorite, steppers): Android's minimum target. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'muted',
  active,
  disabled,
  bordered,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: 'muted' | 'link' | 'default';
  active?: boolean;
  disabled?: boolean;
  /** A hairline ring (steppers), instead of a bare glyph. */
  bordered?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      disabled={disabled}
      android_ripple={{ color: colors.accent, borderless: true, radius: 24 }}
      style={({ pressed }) => [
        styles.iconButton,
        bordered && { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
        pressed && { backgroundColor: colors.accent },
        disabled && { opacity: 0.4 },
      ]}
    >
      <View>
        <Icon icon={icon} size={20} tone={active ? 'link' : tone} />
      </View>
    </Pressable>
  );
}
