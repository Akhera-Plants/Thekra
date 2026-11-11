'use client';

import { useQuery } from '@tanstack/react-query';
import { getFavoriteQuoteIds } from '@/lib/api/favorites';
import { queryKeys } from '@/lib/query-keys';
import { useSession } from '@/features/auth/hooks/useSession';

/**
 * Returns a Set<string> of favorited quote IDs for O(1) membership checks.
 * Only active when the user is authenticated.
 */
export function useFavoriteQuoteIds(): {
  ids: Set<string>;
  isLoading: boolean;
} {
  const { isAuthenticated } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.favorites.quoteIds,
    queryFn: getFavoriteQuoteIds,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  return { ids: new Set(data ?? []), isLoading };
}
