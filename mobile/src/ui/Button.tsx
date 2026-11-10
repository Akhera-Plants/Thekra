/**
 * Buttons after site-public.css: `.solid-button` (primary fill), `.outline-button` (card fill, primary label), a quiet
 * outline (`ghost`: no fill, ink label) and a destructive outline. Every action has a visible frame (owner, 2026-11-01).
 *
 * Exactly three sizes (owner round 5, O-02 / A-10):
 * - `lg`: the page's main action. Full width, 48 high, body-size label.
 * - `md` (default): a section's action. 44 high.
 * - `sm`: a row's action, compact. Still 44 high (the touch target), less padding, small label.
 * One solid button per area (A-08): row actions are `outline`/`ghost` at `sm`. Two related actions go in a
 * `ButtonPair`, never stacked one above the other.
 * Interactive edges use `controlBorder` (≥3:1, A-18).
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { ForwardArrow, Icon } from './Icon';
import { Text } from './Text';

/** `danger`: the solid destructive fill, only for the confirming action of a ConfirmDialog («احذفها»). */
export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'destructive' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

/** The minimum touch target on every control (WCAG 2.5.5, Apple HIG 44pt; A-09). */
export const MIN_TARGET = 44;

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** `lg` page action (full width, 48) · `md` section action (44, default) · `sm` row action (44, compact). */
  size?: ButtonSize;
  /** Leading icon. */
  icon?: LucideIcon;
  /** A forward arrow after the label (the site's call-to-action buttons). */
  arrow?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the container's width (implied by `lg`). */
  block?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** Internal (ButtonPair): reports how many lines the label took. */
  onLabelLines?: (lines: number) => void;
}

const makeStyles = (t: Theme) => ({
  base: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space.md,
    minHeight: MIN_TARGET,
    paddingVertical: 6,
    paddingHorizontal: 17,
    borderRadius: radius.control,
    borderWidth: 1,
    alignSelf: 'flex-start' as const,
  },
  lg: { minHeight: 48, alignSelf: 'stretch' as const, paddingHorizontal: space.xl },
  sm: { paddingVertical: 4, paddingHorizontal: space.md, gap: 6 },
  block: { alignSelf: 'stretch' as const },
  solid: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  outline: { backgroundColor: t.colors.card, borderColor: t.colors.controlBorder },
  outlinePressed: { backgroundColor: t.colors.muted, borderColor: t.colors.ring },
  ghost: { backgroundColor: 'transparent', borderColor: t.colors.controlBorder },
  ghostPressed: { backgroundColor: t.colors.accent, borderColor: t.colors.ring },
  destructive: { backgroundColor: t.colors.card, borderColor: t.colors.destructive },
  danger: { backgroundColor: t.colors.destructive, borderColor: t.colors.destructive },
  disabled: { opacity: 0.45 },
  label: { flexShrink: 1, textAlign: 'center' as const },
  textLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: MIN_TARGET,
    paddingVertical: 4,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: t.colors.controlBorder,
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
  pair: { flexDirection: 'row' as const, alignItems: 'stretch' as const, gap: space.sm, alignSelf: 'stretch' as const },
  pairStacked: { flexDirection: 'column' as const },
  pairItem: { flex: 1, flexBasis: 0, minWidth: 0 },
  pairItemStacked: { flex: 0, flexBasis: 'auto' as const, alignSelf: 'stretch' as const },
});

export function Button({
  label,
  onPress,
  variant = 'solid',
  size = 'md',
  icon,
  arrow,
  disabled,
  loading,
  block,
  accessibilityLabel,
  accessibilityHint,
  style,
  onLabelLines,
}: ButtonProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const tone = variant === 'solid' ? 'inverse' : variant === 'destructive' ? 'destructive' : variant === 'ghost' ? 'default' : 'link';
  /** The danger fill takes its own foreground (white on the light theme, ink on the dark one). */
  const ink = variant === 'danger' ? colors.destructiveForeground : undefined;
  const off = disabled || loading;
  const handleTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => onLabelLines?.(e.nativeEvent.lines.length),
    [onLabelLines],
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      android_ripple={{ color: variant === 'solid' ? colors.ring : variant === 'danger' ? colors.destructiveSoft : colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        size === 'lg' && styles.lg,
        size === 'sm' && styles.sm,
        block && styles.block,
        pressed && variant === 'solid' && { opacity: 0.88 },
        pressed && variant === 'outline' && styles.outlinePressed,
        pressed && variant === 'ghost' && styles.ghostPressed,
        pressed && (variant === 'destructive' || variant === 'danger') && { opacity: 0.8 },
        off && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={ink ?? (variant === 'solid' ? colors.primaryForeground : colors.primary)} />
      ) : icon ? (
        <Icon icon={icon} size={size === 'sm' ? 16 : 17} tone={tone} color={ink} />
      ) : null}
      <Text
        variant={size === 'lg' ? 'body' : 'small'}
        weight="medium"
        tone={tone}
        style={[styles.label, ink ? { color: ink } : null]}
        onTextLayout={onLabelLines ? handleTextLayout : undefined}
      >
        {label}
      </Text>
      {arrow ? <ForwardArrow size={size === 'sm' ? 16 : 17} tone={tone} color={ink} /> : null}
    </Pressable>
  );
}

export interface PairAction {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  arrow?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  /** Defaults: the first action `solid`, the second `outline`. Pass `outline` on both where the area already has its solid. */
  variant?: ButtonVariant;
}

/**
 * Two related actions as one choice (owner round 5, O-02 / A-06): side by side in one container, the same width and
 * the same height, the more important one solid (first, on the reading start) and the other outlined. They stack,
 * still full width, only when a label cannot fit on one line at half width. `secondary` may be omitted (then the
 * primary fills the row at the same size, so screens keep one rule).
 */
export function ButtonPair({
  primary,
  secondary,
  size = 'md',
  style,
}: {
  primary: PairAction;
  secondary?: PairAction | null;
  /** `lg` (48) at the foot of a page or sheet, `md` (44) inside a card or section. */
  size?: 'lg' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles(makeStyles);
  const [stacked, setStacked] = useState(false);
  const [width, setWidth] = useState(0);
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = Math.round(e.nativeEvent.layout.width);
      // A new width (rotation, a wider sheet) gets a fresh try side by side.
      if (Math.abs(w - width) > 2) {
        setWidth(w);
        setStacked(false);
      }
    },
    [width],
  );
  const handleLines = useCallback((lines: number) => {
    if (lines > 1) setStacked(true);
  }, []);
  const items = secondary ? [primary, secondary] : [primary];
  return (
    <View style={[styles.pair, stacked && styles.pairStacked, style]} onLayout={handleLayout}>
      {items.map((a, i) => (
        <View key={i} style={[styles.pairItem, stacked && styles.pairItemStacked]}>
          <Button
            label={a.label}
            onPress={a.onPress}
            icon={a.icon}
            arrow={a.arrow}
            disabled={a.disabled}
            loading={a.loading}
            accessibilityLabel={a.accessibilityLabel}
            variant={a.variant ?? (i === 0 ? 'solid' : 'outline')}
            size={size === 'lg' ? 'lg' : 'md'}
            block
            style={{ flexGrow: 1, paddingHorizontal: space.md }}
            onLabelLines={stacked ? undefined : handleLines}
          />
        </View>
      ))}
    </View>
  );
}

/** `.text-link`: a primary label with a forward arrow, in a hairline frame so it reads as a control. */
export function TextLink({
  label,
  onPress,
  muted,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  muted?: boolean;
  /** A label with its context («المزيد: آيات وأحاديث…») where the visible word alone is ambiguous. */
  accessibilityLabel?: string;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
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
        bordered && { borderWidth: 1, borderColor: colors.controlBorder, backgroundColor: colors.card },
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
