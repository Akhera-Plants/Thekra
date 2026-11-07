/**
 * Page frame, header and spacing helpers, after the website's page layout (20 gutter, page-lead, eyebrow,
 * hairline rules). No background art: the page is plain (owner, 2026-11-03).
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
import { ArrowLeft, ArrowRight, Sprout, X } from 'lucide-react-native';
import { GUTTER, radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { IconButton } from './Button';
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
  sectionHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md },
  sectionTitle: { flex: 1, minWidth: 0 },
  sectionAction: { flexShrink: 0, maxWidth: '50%' as const },
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
    gap: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  brandStart: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, minWidth: 0 },
  brandTrailing: { flexShrink: 1 },
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

function ScreenFrame({ children, edges = ['top'], scroll = true, refreshing, onRefresh, contentStyle }: Omit<ScreenProps, 'keyboard'>) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
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
  /** The page's own action ON the title's line, opposite the title (A-07): a `sm`/`md` Button («أضف قريبًا»). */
  action?: React.ReactNode;
  children?: React.ReactNode;
}

/** The page title block. On stack screens the native header (see `useStackScreenOptions`) owns Back. */
export function PageHeader({ eyebrow, title, lead, action, children }: PageHeaderProps) {
  const styles = useStyles(makeStyles);
  const heading = (
    <Text variant="display" accessibilityRole="header" style={action ? styles.sectionTitle : undefined}>
      {title}
    </Text>
  );
  return (
    <View style={styles.header}>
      {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
      {action ? (
        <View style={styles.sectionHead}>
          {heading}
          <View style={styles.sectionAction}>{action}</View>
        </View>
      ) : (
        heading
      )}
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
  const { t } = useTranslation();
  const back = t('common.back');
  return useMemo(
    () => ({
      headerShown: true,
      // Shown nowhere in the bar: `title` may still name the screen for accessibility and recents.
      headerTitle: '',
      headerBackButtonDisplayMode: 'minimal' as const,
      // iOS reads the back item by this title even when only the chevron shows: «رجوع», not the system's «Back» (A-19).
      headerBackTitle: back,
      // The web's header button names itself «Go back» in English and is 30×30: our own 48×48 «رجوع» there.
      ...(Platform.OS === 'web'
        ? { headerLeft: ({ canGoBack }: { canGoBack?: boolean }) => (canGoBack ? <BackButton label={back} /> : null) }
        : null),
      headerShadowVisible: false,
      headerTintColor: colors.foreground,
      headerStyle: { backgroundColor: colors.background },
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors, back],
  );
}

/** The header's Back on the web: a 48×48 target named in the UI language (A-09, A-19). */
function BackButton({ label }: { label: string }) {
  const { rtl } = useTheme();
  return <IconButton icon={rtl ? ArrowRight : ArrowLeft} label={label} tone="default" onPress={() => router.back()} />;
}

/**
 * The site header's wordmark: «ذكرى» with the sprout, `tagline` right after it, and `end` (the menu button) alone on
 * the inline-end side (owner, 2026-11-01: the menu opposite the logo: the left in Arabic, the right in English).
 */
export function BrandBar({ tagline, end }: { tagline?: React.ReactNode; end?: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandStart}>
        <View style={styles.brand}>
          <Icon icon={Sprout} size={22} tone="link" strokeWidth={1.3} />
          <Text variant="display" style={{ fontSize: 26, lineHeight: 40 }} accessibilityRole="header">
            {t('app.name')}
          </Text>
        </View>
        {tagline ? <View style={styles.brandTrailing}>{tagline}</View> : null}
      </View>
      {end}
    </View>
  );
}

export interface SectionHeaderProps {
  title: string;
  /** A short line under the title (muted). */
  lead?: string;
  /** A second line in body ink under the title (e.g. the habit or sin the texts belong to). */
  subtitle?: string;
  /**
   * The section's action, ON the title's line at the inline end, opposite the title (owner round 5, A-07): a `sm`
   * outline Button or a TextLink («المزيد», «الكل», «أضف»). Never on a row of its own under the title.
   */
  action?: React.ReactNode;
  /** `title` (23, the page's sections: default) or `heading` (19, a block inside a card or a sheet). */
  size?: 'title' | 'heading';
  style?: StyleProp<ViewStyle>;
}

/** A section's title row: the title (and its lead) on the reading start, the action centred on it at the end. */
export function SectionHeader({ title, lead, subtitle, action, size = 'title', style }: SectionHeaderProps) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.sectionHead, style]}>
      <View style={styles.sectionTitle}>
        <Text variant={size} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text variant="body">{subtitle}</Text> : null}
        {lead ? (
          <Text variant="small" tone="muted">
            {lead}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.sectionAction}>{action}</View> : null}
    </View>
  );
}

/**
 * A titled block of a page: `SectionHeader` (the action on the title's line) and the content. Sections of a page are
 * separated by `SectionDivider`, never by a hairline; the first row after the header draws no top border.
 */
export function Section({
  title,
  lead,
  action,
  children,
  style,
}: {
  title?: string;
  lead?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.section, style]}>
      {title ? <SectionHeader title={title} lead={lead} action={action} /> : null}
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

/** The plain hairline: between items of ONE list only. Between sections use `SectionDivider`. */
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
