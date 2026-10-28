import { useEffect, useSyncExternalStore } from 'react';
import { useSession } from '@/features/auth/hooks/useSession';
import { accountsEnabled } from '@/lib/accounts';
import {
  getServerSyncStatus,
  getSyncStatus,
  setSyncAccount,
  subscribeSyncStatus,
  type SyncStatus,
} from '@/lib/practice/sync-controller';

export interface PracticeSyncState {
  status: SyncStatus;
  /** Accounts are turned on for this deployment. */
  accounts: boolean;
  signedIn: boolean;
  /** The session is still being restored (do not show sign-in prompts yet). */
  sessionLoading: boolean;
}

/**
 * Runs practice sync while the calling page is open and the visitor is signed in, and returns its status. Mount it
 * once per page (the status component does).
 */
export function usePracticeSync(): PracticeSyncState {
  const accounts = accountsEnabled();
  const { user, isAuthenticated, isLoading } = useSession();
  const account = accounts && isAuthenticated && user ? user.id : null;
  useEffect(() => {
    setSyncAccount(account);
    return () => setSyncAccount(null);
  }, [account]);
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getServerSyncStatus);
  return { status, accounts, signedIn: account !== null, sessionLoading: accounts && isLoading };
}
