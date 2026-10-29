/**
 * Wraps «ترك المعصية» (see src/lib/practice/use-sin-privacy.ts): with the lock on, a calm locked state until the
 * device prompt succeeds, never the program; always, an opaque cover with the app mark while the app is not in the
 * foreground, and no screenshots or switcher snapshot while the page is open.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LockKeyhole, Sprout } from 'lucide-react-native';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useAppInForeground, useHideFromCapture, useSinProgramLock } from '@/lib/practice/use-sin-privacy';
import { space, useStyles, type Theme } from '@/theme';
import { EmptyState, Icon, Screen, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  frame: { flex: 1 },
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: space.sm,
    backgroundColor: t.colors.background,
  },
  locked: { flexGrow: 1, justifyContent: 'center' as const },
});

interface ISinProgramGuardProps {
  children: React.ReactNode;
  /** Opened from the unlocked program page (the «لحظة الضعف» modal): no second prompt; the background still locks. */
  startOpen?: boolean;
}

export function SinProgramGuard({ children, startOpen }: ISinProgramGuardProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const lockOn = usePracticeStore((s) => s.prefs.sinLock);
  const foreground = useAppInForeground();
  const lock = useSinProgramLock(
    hydrated && lockOn,
    { promptMessage: t('sinLock.prompt'), cancelLabel: t('common.cancel') },
    startOpen,
  );
  useHideFromCapture();

  // Until the saved prefs are read, whether the lock is on is not known: nothing of the page shows.
  if (!hydrated) return <PrivacyCover />;

  return (
    <View style={styles.frame}>
      {lock.state === 'open' ? (
        children
      ) : (
        <Screen edges={['bottom']} decor contentStyle={styles.locked}>
          <EmptyState
            icon={LockKeyhole}
            message={t('sinLock.lockedTitle')}
            hint={t('sinLock.lockedHint')}
            actionLabel={lock.state === 'locked' ? t('sinLock.unlock') : undefined}
            onAction={lock.unlock}
          />
        </Screen>
      )}
      {foreground ? null : <PrivacyCover />}
    </View>
  );
}

/** Opaque, with the app's mark only: what the app switcher and a passer-by see. */
function PrivacyCover() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.cover} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon icon={Sprout} size={40} tone="link" strokeWidth={1.3} />
      <Text variant="title">{t('app.name')}</Text>
    </View>
  );
}
