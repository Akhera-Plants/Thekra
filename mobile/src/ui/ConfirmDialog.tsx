/**
 * The app's one confirmation (owner round 7, R7-A2: «لا تستخدم كومبوننتس نيتف … مودال صغير للكونفرميشن خليه ضمن
 * ثيمنا»). Never `Alert.alert`: a small card in our identity over a soft veil — the mark in a soft circle, the title in
 * the heading style, one line of context, then the two actions side by side at the same size (the solid one first,
 * «إلغاء» outlined). The website has the same component (frontend/src/components/ui/confirm-dialog.tsx).
 *
 * Controlled: `<ConfirmDialog visible … onConfirm={…} onCancel={…} />`.
 * Imperative (also outside React): `if (await confirm({ title, confirmLabel, tone: 'destructive' })) …`;
 * `ConfirmHost` is mounted once in app/_layout.tsx, next to `ToastHost`.
 * A notice with one button (`cancelLabel: null`) replaces `Alert.alert(message)`.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { GUTTER, radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { ButtonPair } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ConfirmOptions {
  title: string;
  /** One or two short lines of context. */
  message?: string;
  /** The solid action: say what happens («احذفها», «غيّر الرمز»), never «نعم/موافق». */
  confirmLabel: string;
  /** Defaults to «إلغاء»; `null` shows the solid action alone (a notice). */
  cancelLabel?: string | null;
  /** `destructive` for deleting, clearing or signing out; `primary` (default) otherwise. */
  tone?: 'primary' | 'destructive';
  /** The mark in the circle; a warning triangle for `destructive` when omitted, `null` for none. */
  icon?: LucideIcon | null;
}

export interface ConfirmDialogProps extends ConfirmOptions {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content between the text and the actions. */
  children?: React.ReactNode;
}

const makeStyles = (t: Theme) => ({
  root: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: GUTTER },
  veil: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.overlay },
  card: {
    width: '100%' as const,
    maxWidth: 400,
    gap: space.lg,
    padding: space['2xl'],
    borderRadius: radius.card + 4,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
    shadowColor: '#000000',
    shadowOpacity: t.dark ? 0.5 : 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  head: { gap: space.sm },
  mark: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: space.xs },
  actions: { marginTop: space.xs },
});

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  icon,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const Mark = icon === undefined ? (tone === 'destructive' ? TriangleAlert : null) : icon;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    anim.setValue(0);
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (cancelled) return;
        Animated.timing(anim, {
          toValue: 1,
          duration: reduced ? 0 : 220,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [visible, anim]);

  const cancel = cancelLabel === null ? null : { label: cancelLabel ?? t('common.cancel'), onPress: onCancel, variant: 'outline' as const };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={styles.veil} onPress={onCancel} accessibilityRole="button" accessibilityLabel={cancel?.label ?? t('common.close')} />
        <Animated.View
          accessibilityViewIsModal
          role="alertdialog"
          aria-modal
          style={[
            styles.card,
            {
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <View style={styles.head}>
            {Mark ? (
              <View style={[styles.mark, { backgroundColor: tone === 'destructive' ? colors.destructiveSoft : colors.primarySoft }]}>
                <Icon icon={Mark} size={22} strokeWidth={1.6} tone={tone === 'destructive' ? 'destructive' : 'link'} />
              </View>
            ) : null}
            <Text variant="heading" weight="semibold" accessibilityRole="header">
              {title}
            </Text>
            {message ? (
              <Text variant="lead" tone="muted">
                {message}
              </Text>
            ) : null}
          </View>
          {children}
          <ButtonPair
            style={styles.actions}
            primary={{ label: confirmLabel, onPress: onConfirm, variant: tone === 'destructive' ? 'danger' : 'solid' }}
            secondary={cancel}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

interface ConfirmState {
  current: (ConfirmOptions & { id: number; resolve: (ok: boolean) => void }) | null;
  open: (o: ConfirmOptions) => Promise<boolean>;
  settle: (ok: boolean) => void;
}

let seq = 0;

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,
  open: (o) =>
    new Promise<boolean>((resolve) => {
      // A second request answers the first with «no» rather than leaving it pending.
      get().current?.resolve(false);
      set({ current: { ...o, id: ++seq, resolve } });
    }),
  settle: (ok) => {
    const c = get().current;
    if (!c) return;
    set({ current: null });
    c.resolve(ok);
  },
}));

/** Asks in our own dialog; resolves `true` on the solid action, `false` on cancel, the veil or Android back. */
export function confirm(o: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(o);
}

/** Mounted once (app/_layout.tsx): shows what `confirm()` asks. */
export function ConfirmHost() {
  const current = useConfirmStore((s) => s.current);
  const settle = useConfirmStore((s) => s.settle);
  // Keep the last request on screen while the fade-out runs.
  const [shown, setShown] = useState(current);
  useEffect(() => {
    if (current) setShown(current);
  }, [current]);
  if (!shown) return null;
  const { id: _id, resolve: _resolve, ...options } = shown;
  return <ConfirmDialog {...options} visible={current !== null} onConfirm={() => settle(true)} onCancel={() => settle(false)} />;
}

/**
 * The local form, for a screen that is itself inside a `Modal` (a BottomSheet, the loop builder): iOS presents a
 * second modal only from the one on top, so the dialog is rendered inside that tree. Render `dialog` once in it.
 */
export function useConfirm(): { confirm: (o: ConfirmOptions) => Promise<boolean>; dialog: React.ReactNode } {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const [visible, setVisible] = useState(false);
  const ask = React.useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...o, resolve });
        setVisible(true);
      }),
    [],
  );
  const settle = (ok: boolean) => {
    setVisible(false);
    state?.resolve(ok);
  };
  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      tone={state.tone}
      icon={state.icon}
      visible={visible}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;
  return { confirm: ask, dialog };
}
