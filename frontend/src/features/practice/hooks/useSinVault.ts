import { useEffect, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth/hooks/useSession';
import { accountsEnabled } from '@/lib/accounts';
import { deleteSinVault, getSinVault, putSinVault } from '@/lib/api/practice-me';
import {
  getServerVaultSession,
  getVaultSession,
  setVaultSession,
  subscribeVaultSession,
  vaultSessionOwner,
  type VaultApi,
} from '@/lib/practice/vault-flow';
import { queryKeys } from '@/lib/query-keys';

export const vaultApi: VaultApi = { get: getSinVault, put: putSinVault, remove: deleteSinVault };

/**
 * The account's encrypted sin vault (only when signed in) and this tab's unlocked key. The key is dropped when the
 * visitor signs out or another account signs in.
 */
export function useSinVault() {
  const accounts = accountsEnabled();
  const { user, isAuthenticated, isLoading } = useSession();
  const userId = accounts && isAuthenticated && user ? user.id : null;
  const vault = useQuery({
    queryKey: queryKeys.practice.vault(userId ?? ''),
    queryFn: getSinVault,
    enabled: userId !== null,
    staleTime: 0,
  });
  const session = useSyncExternalStore(subscribeVaultSession, getVaultSession, getServerVaultSession);
  useEffect(() => {
    if (!isLoading && getVaultSession() && vaultSessionOwner() !== userId) setVaultSession(null);
  }, [userId, isLoading]);
  return { accounts, userId, sessionLoading: accounts && isLoading, vault, session };
}
