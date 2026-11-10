/**
 * Showing «تخفّف» details outside the program screen (owner round 6, C-02e / C-02d): the rows in «العادات» are covered
 * by default, and «سجلّي» shows a program's day only after the device lock. This reuses the app's existing unlock
 * flow (use-sin-privacy `unlockWithDevice`, vault-runner `openWithDevice`): nothing new is stored or sent.
 *
 * - `openProgram()`: the covered row's tap. With the programs already open in memory, the device lock is asked first
 *   (a covered row must never open on a bare tap); otherwise the program screen's own guard asks for it.
 * - `reveal()`: «سجلّي». The device lock (programs open) or the usual opening (kept key behind biometrics); a vault that
 *   needs its code sends the member to the program screen, which asks for it. `revealed` resets when the screen leaves.
 */

import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePracticeStore } from './practice-store';
import { unlockWithDevice } from './use-sin-privacy';
import { isVaultUnlocked, openWithDevice, useVaultState } from './vault-runner';
import { useAuthStore } from '@/lib/stores/auth-store';

export function useProgramReveal() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const status = useVaultState((s) => s.status);
  const localPrograms = usePracticeStore((s) => s.store.programs.length > 0);
  const [revealed, setRevealed] = useState(false);
  const labels = { promptMessage: t('sinLock.prompt'), cancelLabel: t('common.cancel') };
  // Round 7 (C6): programs without a privacy code (no vault) stay on this device and are not covered: nothing to unlock.
  const noCode = status === 'none' && localPrograms;
  const open = isVaultUnlocked() || status === 'unlocked' || noCode;
  /** The member has «تخفّف» programs (or a vault that holds them, still locked). */
  const hasPrograms = localPrograms || status === 'locked' || status === 'unlocked';

  const openProgram = useCallback(async () => {
    if (open && !noCode) {
      const ok = await unlockWithDevice(labels);
      if (!ok) return;
    }
    router.push('/practice/sin-program');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noCode, labels.promptMessage, labels.cancelLabel]);

  const reveal = useCallback(async () => {
    if (noCode) {
      setRevealed(true);
      return;
    }
    if (open) {
      if (await unlockWithDevice(labels)) setRevealed(true);
      return;
    }
    if (!userId) return;
    const result = await openWithDevice(userId, labels);
    if (result === 'open' || result === 'offline') setRevealed(true);
    else if (result === 'code') router.push('/practice/sin-program');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noCode, userId, labels.promptMessage, labels.cancelLabel]);

  return {
    open,
    hasPrograms,
    /** No privacy code: shown like any habit (round 7, C6). */
    noCode,
    revealed: noCode || (revealed && (isVaultUnlocked() || status === 'unlocked' || localPrograms)),
    openProgram,
    reveal,
  };
}
