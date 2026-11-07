/**
 * The app's one confirmation after a save (owner round 5, A-11; round-4 rule «after create/save: feedback»): a short
 * line at the bottom of the screen, gone by itself after a few seconds, with an optional «تراجع». It is announced to
 * screen readers (VoiceOver/TalkBack announcement; a polite live region on the web) and never takes the focus.
 *
 * Use: `toast('حُفظت المحاسبة')` or `toast({ message, actionLabel: t('common.undo'), onAction })` from anywhere
 * (also outside React). `ToastHost` is mounted once in app/_layout.tsx. A new toast replaces the one on screen.
 */

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { CircleCheck } from 'lucide-react-native';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { MIN_TARGET } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ToastOptions {
  message: string;
  /** e.g. «تراجع». */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds on screen (default 3500, 6000 with an action so it can be reached). */
  duration?: number;
}

interface ToastState {
  current: (ToastOptions & { id: number }) | null;
  show: (o: ToastOptions) => void;
  hide: (id?: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  show: (o) => set({ current: { ...o, id: ++seq } }),
  hide: (id) => {
    if (id === undefined || get().current?.id === id) set({ current: null });
  },
}));

/** Shows a toast. A string is the message alone. */
export function toast(o: ToastOptions | string): void {
  useToastStore.getState().show(typeof o === 'string' ? { message: o } : o);
}

/** The hook form, for components that prefer it. */
export function useToast(): (o: ToastOptions | string) => void {
  return toast;
}

/** Space kept under the toast: the tab bar's height, so it never covers the tabs or a page's bottom action. */
const BOTTOM_GAP = 76;

const makeStyles = (t: Theme) => ({
  layer: { position: 'absolute' as const, start: 0, end: 0, alignItems: 'center' as const, paddingHorizontal: space.lg },
  toast: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 52,
    maxWidth: 520,
    width: '100%' as const,
    paddingStart: space.lg,
    paddingEnd: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.card,
    backgroundColor: t.dark ? t.colors.muted : t.colors.foreground,
    borderWidth: t.dark ? 1 : 0,
    borderColor: t.colors.controlBorder,
    shadowColor: t.colors.foreground,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  message: { flex: 1, minWidth: 0, paddingVertical: space.sm },
  action: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    paddingHorizontal: space.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.control,
  },
});

export function ToastHost() {
  const styles = useStyles(makeStyles);
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const current = useToastStore((s) => s.current);
  const hide = useToastStore((s) => s.hide);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (cancelled) return;
        Animated.timing(anim, { toValue: 1, duration: reduced ? 0 : 200, useNativeDriver: Platform.OS !== 'web' }).start();
      });
    // The live region carries it on the web; native screen readers need the announcement.
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(current.actionLabel ? `${current.message}. ${current.actionLabel}` : current.message);
    const ms = current.duration ?? (current.onAction ? 6000 : 3500);
    const timer = setTimeout(() => hide(current.id), ms);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      anim.setValue(0);
    };
  }, [current, anim, hide]);

  if (!current) return null;
  // Light theme: ink toast with page-coloured words; dark: the raised surface with ink words.
  const ink = dark ? colors.foreground : colors.background;
  const actionInk = dark ? colors.link : colors.background;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: insets.bottom + BOTTOM_GAP }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        role="status"
        aria-live="polite"
        style={[
          styles.toast,
          { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}
      >
        <Icon icon={CircleCheck} size={18} color={dark ? colors.link : colors.background} />
        <Text variant="small" style={[styles.message, { color: ink }]}>
          {current.message}
        </Text>
        {current.actionLabel && current.onAction ? (
          <Pressable
            onPress={() => {
              current.onAction?.();
              hide(current.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={current.actionLabel}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
          >
            <Text variant="small" weight="semibold" style={{ color: actionInk, textDecorationLine: 'underline' }}>
              {current.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
