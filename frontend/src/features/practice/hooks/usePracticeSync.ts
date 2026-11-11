import { useEffect, useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { useSession } from '@/features/auth/hooks/useSession';
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
  signedIn: boolean;
  /** The session is still being restored (do not show sign-in prompts yet). */
  sessionLoading: boolean;
}

/** Runs practice sync for the signed-in account while the app is open. Mounted once, for every page (`PracticeSyncHost`). */
export function usePracticeSyncRunner(): void {
  const { user, isAuthenticated } = useSession();
  const account = isAuthenticated && user ? user.id : null;
  useEffect(() => {
    setSyncAccount(account);
    return () => setSyncAccount(null);
  }, [account]);
}

/**
 * The sync status for a page that shows it (the status component). A signed-in visit also re-sends this browser's push
 * subscription, if it has one (once per account and language per page load). The sync itself runs from
 * `PracticeSyncHost`, so a data page that does not show the status (habits, reviews) is current too: the device copy is
 * emptied at sign-out, and the next sign-in must refill it wherever the person lands.
 */
export function usePracticeSync(): PracticeSyncState {
  const { user, isAuthenticated, isLoading } = useSession();
  const account = isAuthenticated && user ? user.id : null;
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  useEffect(() => {
    if (account) void refreshPushSubscription(account, locale);
  }, [account, locale]);
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getServerSyncStatus);
  return { status, signedIn: account !== null, sessionLoading: isLoading };
}
