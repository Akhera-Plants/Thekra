/**
 * Small building blocks for the practice screens (habits, kinship, sin program, calendar).
 * Tokens only (src/lib/tokens.ts); logical layout (rows flip with RTL); Western digits in every number.
 */

import React from 'react';
import {
  ActivityIndicator,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize, LineHeight, Radius, Spacing } from '@/lib/tokens';

export function Screen({ children, edges }: { children: React.ReactNode; edges?: ('top' | 'bottom')[] }) {
  return (
    <SafeAreaView style={styles.safe} edges={edges ?? ['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Card({ children, style, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'info' | 'warning' | 'private' }) {
  return (
    <View
      style={[
        styles.card,
        tone === 'info' && styles.cardInfo,
        tone === 'warning' && styles.cardWarning,
        tone === 'private' && styles.cardPrivate,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Body({ children, muted, small }: { children: React.ReactNode; muted?: boolean; small?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted, small && styles.small]}>{children}</Text>;
}

/** Reviewed Arabic guidance text (catalog content), with the Arabic face and line height. */
export function ArabicBody({ children }: { children: React.ReactNode }) {
  return <Text style={styles.arabicBody}>{children}</Text>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  compact,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        variant === 'primary' && styles.btnPrimary,
        variant === 'outline' && styles.btnOutline,
        variant === 'danger' && styles.btnDanger,
        variant === 'ghost' && styles.btnGhost,
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          compact && styles.btnTextCompact,
          (variant === 'outline' || variant === 'ghost') && styles.btnTextOutline,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <Text style={styles.body}>{label}</Text>
        {hint ? <Text style={[styles.body, styles.muted, styles.small]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.textInverse}
      />
    </View>
  );
}

export function LinkRow({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}>
      <View style={styles.flex}>
        <Text style={styles.linkLabel}>{label}</Text>
        {hint ? <Text style={[styles.body, styles.muted, styles.small]}>{hint}</Text> : null}
      </View>
      {/* Points forward in the reading direction (mirrored in RTL, mobile-plan §4). */}
      <Text style={[styles.chevron, { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }]}>›</Text>
    </Pressable>
  );
}

export const practiceStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['2'],
    fontSize: FontSize.base,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing['4'], gap: Spacing['4'], paddingBottom: Spacing['12'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['8'] },
  flex: { flex: 1, gap: Spacing['1'] },
  title: { fontSize: FontSize['2xl'], fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: FontSize.base, color: Colors.textMuted, lineHeight: FontSize.base * LineHeight.relaxed },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginTop: Spacing['2'] },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['4'],
    gap: Spacing['3'],
  },
  cardInfo: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryLight },
  cardWarning: { backgroundColor: Colors.gradeDaifBg, borderColor: Colors.warning },
  cardPrivate: { backgroundColor: Colors.intentSinLight, borderColor: Colors.intentSinLight },
  body: { fontSize: FontSize.base, color: Colors.text, lineHeight: FontSize.base * LineHeight.relaxed },
  arabicBody: {
    fontFamily: FontFamily.arabic,
    fontSize: FontSize.lg,
    lineHeight: FontSize.lg * LineHeight.arabic,
    color: Colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  muted: { color: Colors.textMuted },
  small: { fontSize: FontSize.sm, lineHeight: FontSize.sm * LineHeight.relaxed },
  error: { fontSize: FontSize.sm, color: Colors.error },
  btn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing['3'],
    paddingHorizontal: Spacing['4'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCompact: { paddingVertical: Spacing['2'], paddingHorizontal: Spacing['3'] },
  btnPrimary: { backgroundColor: Colors.primary },
  btnOutline: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background },
  btnDanger: { backgroundColor: Colors.error },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { color: Colors.textInverse, fontWeight: '600', fontSize: FontSize.base },
  btnTextCompact: { fontSize: FontSize.sm },
  btnTextOutline: { color: Colors.primary },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['1.5'],
    backgroundColor: Colors.background,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.text },
  chipTextSelected: { color: Colors.textInverse, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2'] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['3'] },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['3'],
    paddingVertical: Spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  linkLabel: { fontSize: FontSize.base, color: Colors.text, fontWeight: '600' },
  chevron: { fontSize: FontSize.xl, color: Colors.textMuted },
});
