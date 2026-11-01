import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VaultLockedError, type SinProgram } from '@thekra/practice-core';
import { reportFailure } from '@/lib/errors';
import { updateStore } from '@/lib/practice/local-store';
import { lastSealedFingerprint, programsFingerprint, saveVault, setVaultSession } from '@/lib/practice/vault-flow';
import { queryKeys } from '@/lib/query-keys';
import { useSinVault, vaultApi } from './useSinVault';

const AUTOSAVE_DELAY_MS = 800;

export type VaultSaveState = 'idle' | 'saving' | 'error' | 'reopen';

/**
 * Re-seals the encrypted «تخفَّف» copy after each check-in or edit while it is unlocked in this tab. Runs wherever the
 * programs change (the «تخفَّف» page) and where the vault is managed (Settings), so moving the setting did not stop it.
 */
export function useVaultAutosave(programs: readonly SinProgram[]) {
  const queryClient = useQueryClient();
  const vault = useSinVault();
  const { userId, session } = vault;
  const [saveState, setSaveState] = useState<VaultSaveState>('idle');
  const fingerprint = programsFingerprint(programs);

  async function saveNow() {
    const current = session;
    if (!current || !userId) return;
    setSaveState('saving');
    try {
      const result = await saveVault(vaultApi, current, programs);
      const sealed = programsFingerprint(result.programs);
      if (sealed !== programsFingerprint(programs)) updateStore((store) => ({ ...store, programs: result.programs }));
      setVaultSession(result.session, userId, sealed);
      setSaveState('idle');
      void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
    } catch (error) {
      if (error instanceof VaultLockedError) {
        setVaultSession(null);
        setSaveState('reopen');
        void queryClient.invalidateQueries({ queryKey: queryKeys.practice.vault(userId) });
        return;
      }
      reportFailure('sin vault save', error);
      setSaveState('error');
    }
  }

  useEffect(() => {
    if (!session || !userId || fingerprint === lastSealedFingerprint()) return;
    const timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // saveNow reads the latest props; the fingerprint and session are what decide a new seal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, session, userId]);

  return { ...vault, saveState, setSaveState, saveNow };
}
