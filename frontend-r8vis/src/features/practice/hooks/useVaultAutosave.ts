import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VaultLockedError, type SinProgram } from '@thekra/practice-core';
import { reportFailure } from '@/lib/errors';
import { updateStore } from '@/lib/practice/local-store';
import {
  getServerVaultSaveState,
  getVaultSaveState,
  getVaultSession,
  lastSealedFingerprint,
  programsFingerprint,
  saveVault,
  setVaultSaveState,
  setVaultSession,
  subscribeVaultSaveState,
  vaultSessionOwner,
} from '@/lib/practice/vault-flow';
import { queryKeys } from '@/lib/query-keys';
import { useSinVault, vaultApi } from './useSinVault';

/** Debounce before a change is sealed and saved (docs/plan/2026-11-01-sin-vault-always-on.md §4: about 2 s). */
const AUTOSAVE_DELAY_MS = 1500;

export type { VaultSaveState } from '@/lib/practice/vault-flow';

/** The state of the one autosave running on this page (saving, failed, or the code changed elsewhere). */
export function useVaultSaveState() {
  return useSyncExternalStore(subscribeVaultSaveState, getVaultSaveState, getServerVaultSaveState);
}

/**
 * «تخفَّف» is always kept in the account, encrypted (owner, 2026-11-01): every change to a program is sealed with the
 * key unlocked in this tab and saved, after a short pause. Mount it once per page ({@link VaultAutosave}); the
 * screens read {@link useVaultSaveState}. While locked, changes stay on this device and are merged and saved on unlock.
 */
export function useVaultAutosave(programs: readonly SinProgram[]) {
  const queryClient = useQueryClient();
  const vault = useSinVault();
  const { userId, session } = vault;
  const fingerprint = programsFingerprint(programs);

  async function saveNow() {
    const current = getVaultSession();
    if (!current || !userId || vaultSessionOwner() !== userId) return;
    setVaultSaveState('saving');
    try {
      const result = await saveVault(vaultApi, current, programs);
      const sealed = programsFingerprint(result.programs);
      if (sealed !== programsFingerprint(programs)) updateStore((store) => ({ ...store, programs: result.programs }));
      setVaultSession(result.session, userId, sealed);
      setVaultSaveState('idle');
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
    } catch (error) {
      if (error instanceof VaultLockedError) {
        setVaultSession(null);
        setVaultSaveState('reopen');
        void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
        return;
      }
      reportFailure('sin vault save', error);
      setVaultSaveState('error');
    }
  }

  useEffect(() => {
    if (!session || !userId || fingerprint === lastSealedFingerprint()) return;
    const timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // saveNow reads the latest props; the fingerprint and session are what decide a new seal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, session, userId]);

  // A failed save is tried again when the tab comes back into focus or the connection returns.
  useEffect(() => {
    function retry() {
      if (getVaultSaveState() === 'error') void saveNow();
    }
    window.addEventListener('focus', retry);
    window.addEventListener('online', retry);
    return () => {
      window.removeEventListener('focus', retry);
      window.removeEventListener('online', retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, session, userId]);

  return { ...vault, saveNow };
}
