/**
 * TanStack Query client + AsyncStorage persister (offline support).
 * Design decision: mobile-plan.md §6 — AsyncStorage + TanStack Query persister.
 */

import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PERSISTED_QUERY_KEYS } from './query-keys';

// ── Query client ──────────────────────────────────────────────────────────────

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,          // 5 min — don't re-fetch while reading
        gcTime: 10 * 60 * 1000,             // 10 min in-memory GC
        retry: 2,
        refetchOnWindowFocus: false,         // never reshuffle a screen someone is reading
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// ── AsyncStorage persister ────────────────────────────────────────────────────

/** Max age for persisted cache: 7 days. */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'thekra_query_cache',
  throttleTime: 1000,
});

/**
 * Allow-list for persisted queries.
 * Only persist sin/deed catalogues, their quote pages, and favorites.
 * Never persist session data, search results, or admin data.
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const rootKey = queryKey[0];
  if (typeof rootKey !== 'string') return false;
  return (PERSISTED_QUERY_KEYS as readonly string[]).includes(rootKey);
}

export { MAX_AGE };
