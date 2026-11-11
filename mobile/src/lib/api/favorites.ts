import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth-store';
import { apiGet, apiPost, apiDelete } from '../api-client';
import { queryKeys } from '../query-keys';
import type { QuoteDto } from '../types/api';

// ── Fetchers ──────────────────────────────────────────────────────────────────

/** One saved text as `GET /v1/favorites` returns it: the favorite row with its quote inside. */
export interface FavoriteRowDto {
  id: string;
  createdAt: string;
  quote: QuoteDto;
}

/**
 * The saved quotes, newest first. The API wraps each in its favorite row (`{ id, createdAt, quote }`); a list cached by
 * an older build may already hold bare quotes, so both shapes are read. Anything else is dropped, never rendered.
 */
export function favoriteQuotes(rows: readonly unknown[] | null | undefined): QuoteDto[] {
  const out: QuoteDto[] = [];
  for (const row of rows ?? []) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<FavoriteRowDto> & Partial<QuoteDto>;
    const quote = r.quote && typeof r.quote === 'object' ? r.quote : typeof r.textAr === 'string' ? (r as QuoteDto) : null;
    if (quote && typeof quote.id === 'string') out.push({ ...quote, isFavorite: true });
  }
  return out;
}

export async function fetchFavorites(params: { page?: number; limit?: number } = {}) {
  const res = await apiGet<FavoriteRowDto[]>('/favorites', { params });
  return { ...res, data: favoriteQuotes(res.data) };
}

/** `GET /v1/favorites/quote-ids`: the ids of every saved quote. */
export async function fetchFavoriteIds() {
  return apiGet<string[]>('/favorites/quote-ids');
}

export async function addFavorite(quoteId: string) {
  return apiPost<void>('/favorites', { quoteId });
}

export async function removeFavorite(quoteId: string) {
  return apiDelete(`/favorites/${quoteId}`);
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Saved texts belong to an account: the two favorites queries wait for the session (owner round 7, QA: a 401 on
 * `/favorites` and `/favorites/quote-ids` at first load). The access token is restored after launch (`rehydrate`), so a
 * query fired before it was ready was refused, refreshed and sent again; for a guest it was refused every time.
 */
function useSignedIn(): boolean {
  return useAuthStore((s) => s.user !== null);
}

export function useFavorites() {
  const signedIn = useSignedIn();
  return useQuery({
    enabled: signedIn,
    queryKey: queryKeys.favorites.all,
    queryFn: () => fetchFavorites(),
    select: (r) => favoriteQuotes(r.data),
    networkMode: 'offlineFirst',  // serve from cache when offline
    // Refetched when the page opens after a minute: texts saved on the website (or another phone) must show here too;
    // with `Infinity` the persisted list never updated (owner round 7, B10). Offline, the cached list still shows.
    staleTime: 60_000,
  });
}

export function useFavoriteIds() {
  const signedIn = useSignedIn();
  return useQuery({
    enabled: signedIn,
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

  // A guest has no account to save in: say so and offer «سجّل الدخول» instead of a request that fails (owner round 8, item 1).
  const toggle = () => {
    if (useAuthStore.getState().user === null) {
      // Loaded on demand: the sign-in helpers pull in the router, which a plain data module should not need.
      void import('../auth/require-sign-in').then((m) => m.askSignIn('bookmark'));
      return;
    }
    mutation.mutate();
  };

  return { isFavorite, toggle, isPending: mutation.isPending };
}
