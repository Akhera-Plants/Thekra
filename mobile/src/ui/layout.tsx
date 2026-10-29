/**
 * Page frame, header and spacing helpers, after the website's page layout (20 gutter, page-lead, eyebrow,
 * hairline rules), with the website's faint arabesque on the page edges where a page asks for it (`decor`).
 * `SheetScreen` frames a route presented as a native form sheet.
 */

import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import { Sprout, X } from 'lucide-react-native';
import { GUTTER, radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { IconButton } from './Button';
import { PageDecor } from './Decor';
import { Icon } from './Icon';
import { Text } from './Text';

const makeStyles = (t: Theme) => ({
  safe: { flex: 1, backgroundColor: t.colors.background },
  scroll: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] + space.xl, gap: space['2xl'] },
  fill: { flex: 1, paddingHorizontal: GUTTER, paddingTop: space.lg },
  center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: space['3xl'], backgroundColor: t.colors.background },
  header: { gap: space.sm },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  wrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  section: { gap: space.md },
  rule: { height: 1, backgroundColor: t.colors.border },
  sheetHandle: {
    alignSelf: 'center' as const,
    width: 32,
    height: 4,
    marginTop: space.md,
    borderRadius: radius.full,
    backgroundColor: t.colors.mutedForeground,
    opacity: 0.4,
  },
  sheetBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingStart: GUTTER,
    paddingEnd: space.sm,
    paddingTop: space.md,
  },
  sheetTitle: { flex: 1 },
  sheetScroll: { paddingHorizontal: GUTTER, paddingTop: space.sm, paddingBottom: space['4xl'], gap: space['2xl'] },
  brand: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  brandRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
});

export interface ScreenProps {
  children: React.ReactNode;
  /**
   * Safe-area edges: tab screens ['top'] (the tab bar owns the bottom); pushed screens under the native header
   * ['bottom']; full-screen pages without a header ['top', 'bottom'].
   */
  edges?: Edge[];
  /** Scrolling page (default) or a fixed one (lists that scroll themselves). */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** A page with inputs: lifted above the keyboard so the field and the action under it stay visible. */
  keyboard?: boolean;
  /** The website's page-edge arabesque, faint, behind the content (`PageDecor`). */
  decor?: boolean;
}

export function Screen({ keyboard, ...props }: ScreenProps) {
  if (!keyboard) return <ScreenFrame {...props} />;
  return (
    <KeyboardFrame>
      <ScreenFrame {...props} />
    </KeyboardFrame>
  );
}

/** Offsets the lift by the native header above the page (zero on tab screens). */
function KeyboardFrame({ children }: { children: React.ReactNode }) {
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
      {children}
    </KeyboardAvoidingView>
  );
}

function ScreenFrame({ children, edges = ['top'], scroll = true, refreshing, onRefresh, contentStyle, decor }: Omit<ScreenProps, 'keyboard'>) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {decor ? <PageDecor /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/**
 * A route presented as a native form sheet (`presentation: 'formSheet'`, app/_layout.tsx). The sheet has no native
 * header (Android's sheet draws none), so the top row holds the title and «إغلاق»; Android also gets the drag handle
 * that iOS draws itself (`sheetGrabberVisible`). The content scrolls with `nestedScrollEnabled`, which lets Android's
 * bottom sheet hand the drag over to it. No pull to refresh: pulling down moves the sheet.
 */
export function SheetScreen({ title, children }: { title?: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const handleClose = useCallback(() => router.back(), []);
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {Platform.OS === 'android' ? <View style={styles.sheetHandle} /> : null}
      <View style={styles.sheetBar}>
        {title ? (
          <Text variant="heading" accessibilityRole="header" numberOfLines={1} style={styles.sheetTitle}>
            {title}
          </Text>
        ) : (
          <View style={styles.sheetTitle} />
        )}
        <IconButton icon={X} label={t('common.close')} onPress={handleClose} />
      </View>
      <ScrollView nestedScrollEnabled contentContainerStyle={styles.sheetScroll}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export interface PageHeaderProps {
  /** Small primary label above the title (`.eyebrow`), only where the website shows one. */
  eyebrow?: string;
  title: string;
  /** `.page-lead`. */
  lead?: string;
  children?: React.ReactNode;
}

/** The page title block. On stack screens the native header (see `useStackScreenOptions`) owns Back. */
export function PageHeader({ eyebrow, title, lead, children }: PageHeaderProps) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.header}>
      {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
      <Text variant="display" accessibilityRole="header">
        {title}
      </Text>
      {lead ? (
        <Text variant="lead" tone="muted">
          {lead}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Native stack header for pushed screens: the system Back (gesture, button, predictive back) in the page colour,
 * no title (the page shows its own title, as on the website), no hairline.
 */
export function useStackScreenOptions() {
  const { colors } = useTheme();
  return useMemo(
    () => ({
      headerShown: true,
      // Shown nowhere in the bar: `title` may still name the screen for accessibility and recents.
      headerTitle: '',
      headerBackButtonDisplayMode: 'minimal' as const,
      headerShadowVisible: false,
      headerTintColor: colors.foreground,
      headerStyle: { backgroundColor: colors.background },
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors],
  );
}

/** The site header's wordmark: «ذكرى» with the sprout. */
export function BrandBar({ trailing }: { trailing?: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.brandRow}>
      <View style={styles.brand}>
        <Icon icon={Sprout} size={24} tone="link" strokeWidth={1.3} />
        <Text variant="display" style={{ fontSize: 30, lineHeight: 44 }} accessibilityRole="header">
          {t('app.name')}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

export function Section({ title, lead, children, style }: { title?: string; lead?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {lead ? (
            <Text variant="small" tone="muted">
              {lead}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Wrap({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.wrap, style]}>{children}</View>;
}

export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.rule, style]} />;
}

export function Loading() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
