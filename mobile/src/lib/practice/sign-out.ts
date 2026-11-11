/**
 * Before a sign-out (owner round 8): signing out removes the practice data of the account from this device, so what
 * has not reached the account yet is pushed first (online), and what cannot be pushed is reported so the person is
 * warned once, in the sign-out dialog.
 */
import { hasSignOutRisk, signOutRisk } from '@thekra/practice-core';
import { pendingCount, syncPractice } from './sync-runner';
import { usePracticeStore } from './practice-store';
import { isVaultUnlocked, pushVault, useVaultState } from './vault-runner';

/** Pushes the pending habits and the programs (when the vault is open), then says whether anything would be lost. */
export async function signOutWouldLose(userId: string): Promise<boolean> {
  await syncPractice(userId);
  if (isVaultUnlocked()) await pushVault();
  const programs = usePracticeStore.getState().store.programs;
  const inVault = isVaultUnlocked() && !useVaultState.getState().pending;
  return hasSignOutRisk(signOutRisk(pendingCount(), programs.length, inVault));
}
