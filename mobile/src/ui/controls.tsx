/**
 * Selection and input controls after the website:
 * - SegmentTabs: the content filter («الكل · الآيات · الأحاديث»): muted track, full radius, the active tab a
 *   background-coloured pill, counts in muted digits;
 * - Chip: rounded outline chip, selected = primary border and ink on a primary tint;
 * - CheckRow: the habit picker's option card (14 radius, 16 padding, a square check at the start);
 * - SwitchRow, Field (input: hairline, 7 radius, 44 high, card fill), ErrorText.
 */

import React from 'react';
import { Pressable, ScrollView, Switch, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Icon } from './Icon';
import { Text, textStyle } from './Text';

const makeStyles = (t: Theme) => ({
  track: {
    flexDirection: 'row' as const,
    backgroundColor: t.colors.muted,
    borderRadius: radius.full,
    padding: 4,
    gap: 2,
    alignSelf: 'flex-start' as const,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.full,
  },
  tabActive: { backgroundColor: t.colors.background },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  /** The site's chosen option: primary border and ink (`link`: primary in light, the readable ring in dark) on a primary tint. */
  chipSelected: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.link },
  checkRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  checkRowOn: { borderColor: t.colors.ring },
  box: {
    width: 20,
    height: 20,
    marginTop: 5,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: t.colors.mutedForeground,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  boxOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  radio: { borderRadius: radius.full },
  flex: { flex: 1, gap: 2 },
  switchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, minHeight: 48 },
  field: { gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: t.colors.input,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    backgroundColor: t.colors.card,
  },
  inputFocused: { borderColor: t.colors.ring },
  inputError: { borderColor: t.colors.destructive },
});

export interface SegmentItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function SegmentTabs<K extends string>({
  items,
  value,
  onChange,
}: {
  items: SegmentItem<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 0 }}>
      <View style={styles.track} accessibilityRole="tablist">
        {items.map((item) => {
          const active = item.key === value;
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange(item.key)}
              hitSlop={6}
              android_ripple={{ color: colors.accent, borderless: false }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text variant="body" tone={active ? 'default' : 'muted'}>
                {item.label}
              </Text>
              {item.count !== undefined ? (
                <Text variant="caption" tone="muted">
                  {String(item.count)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function Chip({ label, selected, onPress, count }: { label: string; selected?: boolean; onPress: () => void; count?: number }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.75 }]}
    >
      <Text variant="small" weight={selected ? 'medium' : 'regular'} tone={selected ? 'link' : 'default'}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" tone="muted">
          {String(count)}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** An option card with a check (or a radio when `radio`). */
export function CheckRow({
  title,
  hint,
  checked,
  onPress,
  radio,
  children,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  onPress: () => void;
  radio?: boolean;
  children?: React.ReactNode;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.accent }}
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked }}
      style={({ pressed }) => [styles.checkRow, checked && styles.checkRowOn, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.box, radio && styles.radio, checked && styles.boxOn]}>
        {checked ? <Icon icon={Check} size={14} tone="inverse" strokeWidth={2.2} /> : null}
      </View>
      <View style={styles.flex}>
        <Text variant="heading">{title}</Text>
        {hint ? (
          <Text variant="small" tone="muted">
            {hint}
          </Text>
        ) : null}
        {children}
      </View>
    </Pressable>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.card}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

export interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Forwards the input ref (focus chaining with `returnKeyType="next"`). */
export const Field = React.forwardRef<TextInput, FieldProps>(function Field(
  { label, hint, error, style, containerStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.mutedForeground}
        selectionColor={theme.colors.ring}
        {...rest}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          textStyle(theme, 'body'),
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? <ErrorText>{error}</ErrorText> : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="small" tone="destructive" accessibilityRole="alert">
      {children}
    </Text>
  );
}
