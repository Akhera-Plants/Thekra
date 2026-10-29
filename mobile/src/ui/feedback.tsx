/**
 * Empty, error and notice states after the website's EmptyState/ErrorState: a thin lucide icon in a soft circle,
 * a calm sentence, one action. Never alarming. Loading content shows skeletons in the shape of what is coming.
 */

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, View, type DimensionValue } from 'react-native';
import { CircleAlert, Info, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

const makeStyles = (t: Theme) => ({
  state: { alignItems: 'center' as const, gap: space.md, paddingVertical: space['3xl'], paddingHorizontal: space.xl },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: t.colors.muted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  notice: {
    flexDirection: 'row' as const,
    gap: space.sm,
    alignItems: 'flex-start' as const,
  },
});

export function EmptyState({
  icon = Info,
  message,
  hint,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  message: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.state}>
      <View style={styles.badge}>
        <Icon icon={icon} size={26} tone="link" strokeWidth={1.3} />
      </View>
      <Text variant="heading" align="center">
        {message}
      </Text>
      {hint ? (
        <Text variant="small" tone="muted" align="center">
          {hint}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="outline" arrow /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.state}>
      <View style={styles.badge}>
        <Icon icon={CircleAlert} size={26} tone="destructive" strokeWidth={1.3} />
      </View>
      <Text variant="heading" align="center">
        {t('errors.title')}
      </Text>
      {message ? (
        <Text variant="small" tone="muted" align="center">
          {message}
        </Text>
      ) : null}
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} variant="outline" /> : null}
    </View>
  );
}

/** A quiet line with an icon (privacy notes, «تُحفظ على جهازك»). */
export function Notice({ icon = Info, children, tone = 'muted' }: { icon?: LucideIcon; children: React.ReactNode; tone?: 'muted' | 'destructive' }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.notice}>
      <View style={{ marginTop: 4 }}>
        <Icon icon={icon} size={17} tone={tone === 'destructive' ? 'destructive' : 'link'} />
      </View>
      <Text variant="small" tone={tone} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** A placeholder block that breathes slowly; still when the system asks to reduce motion. */
export function Skeleton({ width = '100%', height = 14, round }: { width?: DimensionValue; height?: number; round?: boolean }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);
  return (
    <Animated.View
      style={{ width, height, opacity, borderRadius: round ? radius.full : 6, backgroundColor: colors.muted }}
    />
  );
}

/** The shape of a quote card while it loads. */
export function QuoteCardSkeleton() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t('common.loading')}
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.quote, padding: space.xl, gap: space.lg, backgroundColor: colors.card }}
    >
      <Skeleton width={110} height={28} round />
      <View style={{ gap: space.md }}>
        <Skeleton height={16} />
        <Skeleton height={16} />
        <Skeleton width="70%" height={16} />
      </View>
    </View>
  );
}
