'use client';

import { useQuery } from '@tanstack/react-query';
import { getFavorites, type FavoritesQuery } from '@/lib/api/favorites';
import { queryKeys } from '@/lib/query-keys';
import { useSession } from '@/features/auth/hooks/useSession';

export function useFavorites(params?: FavoritesQuery) {
  const { isAuthenticated } = useSession();

  return useQuery({
    queryKey: [...queryKeys.favorites.all, params] as const,
    queryFn: () => getFavorites(params),
    enabled: isAuthenticated,
  });
}
