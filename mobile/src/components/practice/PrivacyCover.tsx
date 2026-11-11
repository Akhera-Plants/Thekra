/**
 * The opaque cover with the app's mark only: what the app switcher (and a passer-by) sees instead of the screen.
 *
 * `AppSwitcherCover` is mounted once at the root (app/_layout.tsx), above every screen. While the app is not in the
 * foreground it covers the WHOLE app whenever «تخفَّف» has anything on this account or device (a program on the device,
 * or a vault that holds one), because a sin's name or a program's data can show on many screens (the sin page, home,
 * habits, «سجلّي», «لحظة مجاهدة»). Nobody sees it in use: it appears only for the moment the app leaves the foreground.
 * Without a program there is nothing private on any screen, so nothing is covered.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sprout } from 'lucide-react-native';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { shouldCover } from '@/lib/practice/sin-cover';
import { useAppInForeground } from '@/lib/practice/use-sin-privacy';
import { useVaultState } from '@/lib/practice/vault-runner';
import { space, useStyles, type Theme } from '@/theme';
import { Icon, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  cover: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space.sm,
    backgroundColor: t.colors.background,
  },
});

/** Opaque, with the app's mark only. */
export function PrivacyCover() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.cover} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon icon={Sprout} size={40} tone="link" strokeWidth={1.3} />
      <Text variant="title">{t('app.name')}</Text>
    </View>
  );
}

/** The whole-app cover for the app switcher. Renders nothing in the foreground or when there is no program. */
export function AppSwitcherCover() {
  const foreground = useAppInForeground();
  const programs = usePracticeStore((s) => s.store.programs.length);
  const vault = useVaultState((s) => s.status);
  return shouldCover(foreground, programs, vault) ? <PrivacyCover /> : null;
}
