import { useEffect, useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { useSession } from '@/features/auth/hooks/useSession';
import { accountsEnabled } from '@/lib/accounts';
import { refreshPushSubscription } from '@/lib/push/web-push';
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
 * once per page (the status component does). A signed-in visit also re-sends this browser's push subscription, if
 * it has one (once per account and language per page load).
 */
export function usePracticeSync(): PracticeSyncState {
  const accounts = accountsEnabled();
  const { user, isAuthenticated, isLoading } = useSession();
  const account = accounts && isAuthenticated && user ? user.id : null;
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  useEffect(() => {
    setSyncAccount(account);
    return () => setSyncAccount(null);
  }, [account]);
  useEffect(() => {
    if (account) void refreshPushSubscription(account, locale);
  }, [account, locale]);
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getServerSyncStatus);
  return { status, accounts, signedIn: account !== null, sessionLoading: accounts && isLoading };
}
