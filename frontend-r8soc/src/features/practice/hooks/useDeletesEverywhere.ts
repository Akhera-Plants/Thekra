import { useSession } from '@/features/auth/hooks/useSession';

/**
 * True when a deletion here also leaves the account (and so every synced device): accounts are on and the visitor
 * is signed in. Deletions are tombstones that the sync sends (practice-core `deletePlan` / `deleteRelative`).
 */
export function useDeletesEverywhere(): boolean {
  const { isAuthenticated } = useSession();
  return isAuthenticated;
}
