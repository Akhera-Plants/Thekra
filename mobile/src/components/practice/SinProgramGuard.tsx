/**
 * Opens «تخفَّف» (owner decision 2026-11-01: always encrypted in the account, unlocked on the device). For a member:
 * the key kept behind the fingerprint / face (vault-runner `openWithDevice`), else the privacy code (`VaultCodeUnlock`);
 * the account unreachable → the device lock opens the device copy. Back from the background the device lock is asked
 * again. Always an opaque cover with the app mark while the app is not in the foreground. Screenshots are never blocked
 * (owner round 3, item 1).
 * `requireAccount` (the program screen): a guest is sent to sign in, since «تخفَّف» lives in the account. Without it
 * («لحظة مجاهدة» from a sin page) a guest sees the page, which then stores nothing.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, LockKeyhole, Sprout } from 'lucide-react-native';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { unlockWithDevice, useAppInForeground } from '@/lib/practice/use-sin-privacy';
import { openWithDevice } from '@/lib/practice/vault-runner';
import { useAuthStore } from '@/lib/stores/auth-store';
import { space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ButtonPair, Icon, Screen, Text } from '@/ui';
import { VaultCodeUnlock } from './VaultCard';

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
  lockedBox: { alignItems: 'center' as const, gap: space.lg },
});

type GuardState = 'checking' | 'open' | 'code' | 'locked';

/** «أقفل» on the program page (round 6, C-15): closes it at once; reopening asks the device lock (or the code) again. */
const LockContext = createContext<(() => void) | null>(null);

/** The guarded page's «أقفل», or null outside the guard. */
export function useLockProgram(): (() => void) | null {
  return useContext(LockContext);
}

export function SinProgramGuard({ children, requireAccount = false }: { children: React.ReactNode; requireAccount?: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const signedIn = useRequireSignIn('/practice/sin-program', requireAccount);
  const foreground = useAppInForeground();
  const [state, setState] = useState<GuardState>('checking');
  const labels = { promptMessage: t('sinLock.prompt'), cancelLabel: t('common.cancel') };
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const prompting = useRef(false);
  // Locked after the background (the key is still in memory: the device lock alone reopens it).
  const relocked = useRef(false);

  const open = useCallback(() => {
    if (!userId || prompting.current) return;
    prompting.current = true;
    setState('checking');
    void openWithDevice(userId, labelsRef.current).then((result) => {
      prompting.current = false;
      setState(result === 'code' ? 'code' : result === 'cancelled' ? 'locked' : 'open');
    });
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!userId) {
      setState(requireAccount ? 'checking' : 'open');
      return;
    }
    open();
  }, [hydrated, userId, requireAccount, open]);

  // Back from the background: the device lock again (the passcode screen on Android is its own activity, so a prompt
  // in progress does not count as leaving).
  useEffect(() => {
    if (!userId) return;
    let wasBackground = false;
    const sub = AppState.addEventListener('change', (next) => {
      if (prompting.current) return;
      if (next === 'background') {
        wasBackground = true;
        setState((s) => {
          if (s === 'open') relocked.current = true;
          return s === 'open' ? 'locked' : s;
        });
      } else if (next === 'active' && wasBackground) {
        wasBackground = false;
        prompting.current = true;
        void unlockWithDevice(labelsRef.current).then((ok) => {
          prompting.current = false;
          if (ok) relocked.current = false;
          setState((s) => (s === 'locked' ? (ok ? 'open' : 'locked') : s));
        });
      }
    });
    return () => sub.remove();
  }, [userId]);

  const lockNow = useCallback(() => {
    relocked.current = true;
    setState('locked');
  }, []);

  const retry = () => {
    if (!relocked.current) {
      open();
      return;
    }
    prompting.current = true;
    void unlockWithDevice(labelsRef.current).then((ok) => {
      prompting.current = false;
      if (!ok) return;
      relocked.current = false;
      setState('open');
    });
  };

  if (!hydrated || (requireAccount && !signedIn) || state === 'checking') return <PrivacyCover />;

  return (
    <View style={styles.frame}>
      {state === 'open' ? (
        <LockContext.Provider value={userId ? lockNow : null}>{children}</LockContext.Provider>
      ) : state === 'code' && userId ? (
        <Screen edges={['bottom']} keyboard contentStyle={styles.locked}>
          <VaultCodeUnlock userId={userId} onOpened={() => setState('open')} />
        </Screen>
      ) : (
        <Screen edges={['bottom']} contentStyle={styles.locked}>
          <LockedState onUnlock={retry} />
        </Screen>
      )}
      {foreground ? null : <PrivacyCover />}
    </View>
  );
}

/**
 * The locked page (round 6, C-15): the lock state «مقفل ✓», nothing else; a tap opens a small popup whose «افتح القفل»
 * asks the device lock (or the code) again.
 */
function LockedState({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [asking, setAsking] = useState(false);
  return (
    <View style={styles.lockedBox}>
      <Icon icon={LockKeyhole} size={36} tone="link" strokeWidth={1.3} />
      <Text variant="title" align="center">
        {t('sinLock.lockedTitle')}
      </Text>
      <Button label={t('topic.locked')} icon={Check} variant="outline" onPress={() => setAsking(true)} accessibilityLabel={t('topic.lockedLabel')} />
      <BottomSheet
        visible={asking}
        title={t('sinLock.lockedTitle')}
        onClose={() => setAsking(false)}
        footer={
          <ButtonPair
            size="lg"
            primary={{
              label: t('topic.unlock'),
              onPress: () => {
                setAsking(false);
                onUnlock();
              },
            }}
            secondary={{ label: t('common.cancel'), onPress: () => setAsking(false) }}
          />
        }
      >
        <Text variant="body">{t('sinLock.lockedHint')}</Text>
      </BottomSheet>
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
