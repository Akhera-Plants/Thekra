/**
 * The side menu (owner, 2026-11-01): opened by the menu button in the app header, it slides in from the inline-end
 * side, where that button is (the left in Arabic, the right in English; `drawerOffset`) over a dimmed page, and lists the screens that are
 * not a tab under short group headings (`SIDE_MENU`). Members-only items ask a guest to sign in first, then open.
 * Built on the core Modal and Animated (no drawer package); still when the system asks to reduce motion. The
 * backdrop, «إغلاق» and Android back close it.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Bookmark, CalendarDays, Lightbulb, NotebookPen, Repeat, Search, Sprout, Users, X, type LucideIcon } from 'lucide-react-native';
import { isSignedIn, openSignIn } from '@/lib/auth/require-sign-in';
import { SIDE_MENU, drawerOffset, drawerWidth, sideMenuAction, type SideMenuItem, type SideMenuKey } from '@/lib/nav/side-menu';
import { GUTTER, space, useStyles, useTheme, type Theme } from '@/theme';
import { ForwardChevron, Icon, IconButton, Text } from '@/ui';

const SLIDE_MS = 220;

const ICONS: Record<SideMenuKey, LucideIcon> = {
  periodic: Repeat,
  reviews: NotebookPen,
  strategies: Lightbulb,
  circles: Users,
  browse: Search,
  saved: Bookmark,
  seasons: CalendarDays,
};

const makeStyles = (t: Theme) => ({
  /** The panel sits at the row's end: the inline-end side in either direction. */
  root: { flex: 1, flexDirection: 'row' as const, justifyContent: 'flex-end' as const },
  backdrop: { position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.overlay },
  panel: {
    height: '100%' as const,
    backgroundColor: t.colors.background,
    borderStartWidth: 1,
    borderStartColor: t.colors.border,
  },
  head: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingStart: GUTTER,
    paddingEnd: space.sm,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  brand: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  body: { paddingHorizontal: GUTTER, paddingTop: space.lg, gap: space.xl },
  group: { gap: space.xs },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.sm,
  },
  rowText: { flex: 1 },
});

export interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function SideMenu({ visible, onClose }: SideMenuProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { rtl, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const width = drawerWidth(screenWidth);
  const { hiddenX } = drawerOffset(rtl, width);
  const x = useRef(new Animated.Value(hiddenX)).current;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    x.setValue(hiddenX);
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) x.setValue(0);
      else Animated.timing(x, { toValue: 0, duration: SLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [visible, x, hiddenX]);

  const handleChoose = useCallback(
    (entry: SideMenuItem) => {
      onClose();
      const action = sideMenuAction(entry, isSignedIn());
      if (action.kind === 'signIn') openSignIn(action.next);
      else router.push(action.href);
    },
    [onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        {/* At the row's end (`root`): the inline-end side, where the menu button is. */}
        <Animated.View
          style={[styles.panel, { width, paddingTop: insets.top + space.sm, transform: [{ translateX: x }] }]}
          accessibilityViewIsModal
        >
          <View style={styles.head}>
            <View style={styles.brand}>
              <Icon icon={Sprout} size={22} tone="link" strokeWidth={1.3} />
              <Text variant="title" accessibilityRole="header">
                {t('app.name')}
              </Text>
            </View>
            <IconButton icon={X} label={t('common.close')} bordered onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
            {SIDE_MENU.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text variant="eyebrow" accessibilityRole="header">
                  {t(group.titleKey)}
                </Text>
                {group.items.map((entry) => (
                  <Pressable
                    key={entry.key}
                    onPress={() => handleChoose(entry)}
                    accessibilityRole="button"
                    android_ripple={{ color: colors.accent }}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                  >
                    <Icon icon={ICONS[entry.key]} size={22} tone="link" strokeWidth={1.3} />
                    <Text variant="body" style={styles.rowText} numberOfLines={1}>
                      {t(entry.labelKey)}
                    </Text>
                    <ForwardChevron size={16} tone="muted" />
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
