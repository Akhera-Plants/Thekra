import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '../api-client';
import { queryKeys } from '../query-keys';
import type { QuoteDto } from '../types/api';

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchFavorites(params: { page?: number; limit?: number } = {}) {
  return apiGet<QuoteDto[]>('/favorites', { params });
}

export async function fetchFavoriteIds() {
  return apiGet<string[]>('/favorites/ids');
}

export async function addFavorite(quoteId: string) {
  return apiPost<void>('/favorites', { quoteId });
}

export async function removeFavorite(quoteId: string) {
  return apiDelete(`/favorites/${quoteId}`);
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFavorites() {
  return useQuery({
    queryKey: queryKeys.favorites.all,
    queryFn: () => fetchFavorites(),
    select: (r) => r.data,
    networkMode: 'offlineFirst',  // serve from cache when offline
    staleTime: Infinity,           // never refetch automatically in the session
  });
}

export function useFavoriteIds() {
  return useQuery({
    queryKey: queryKeys.favorites.quoteIds,
    queryFn: () => fetchFavoriteIds(),
    select: (r) => new Set(r.data),
  });
}

export function useToggleFavorite(quoteId: string) {
  const qc = useQueryClient();
  const { data: ids } = useFavoriteIds();
  const isFavorite = ids?.has(quoteId) ?? false;

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (isFavorite) {
        await removeFavorite(quoteId);
      } else {
        await addFavorite(quoteId);
      }
    },
    onMutate: async () => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: queryKeys.favorites.quoteIds });
      const snapshot = qc.getQueryData<{ data: string[] }>(queryKeys.favorites.quoteIds);

      qc.setQueryData<{ data: string[] }>(queryKeys.favorites.quoteIds, (old) => {
        if (!old) return old;
        const next = new Set(old.data);
        if (isFavorite) next.delete(quoteId);
        else next.add(quoteId);
        return { data: Array.from(next) };
      });

      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        qc.setQueryData(queryKeys.favorites.quoteIds, ctx.snapshot);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.favorites.all });
      void qc.invalidateQueries({ queryKey: queryKeys.favorites.quoteIds });
    },
    networkMode: 'offlineFirst',
  });

  return { isFavorite, toggle: mutation.mutate, isPending: mutation.isPending };
}
