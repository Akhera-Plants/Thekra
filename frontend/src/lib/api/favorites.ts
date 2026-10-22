/**
 * Favorites API helpers — backend endpoints #24–#27 (backend-plan §3):
 *   GET    /favorites              → paginated list of favorited QuoteDtos
 *   POST   /favorites              → add { quoteId }
 *   GET    /favorites/quote-ids    → string[] of favorited quote IDs (cheap membership check)
 *   DELETE /favorites/:quoteId     → remove
 *
 * All endpoints require a valid Bearer token on apiClient.
 */

import { apiDelete, apiGet, apiPost } from '@/lib/api-client';
import type { PageMeta } from '@/lib/types/api';
import type { QuoteDto } from '@/lib/types/api';

export interface FavoritesQuery {
  page?: number;
  limit?: number;
}

export interface FavoritesResponse {
  items: QuoteDto[];
  meta: PageMeta;
}

export async function getFavorites(
  params?: FavoritesQuery,
): Promise<FavoritesResponse> {
  const { data, meta } = await apiGet<QuoteDto[]>('/favorites', { params });
  return { items: data, meta: meta! };
}

/** Returns the full set of favorited quote IDs for the current user. */
export async function getFavoriteQuoteIds(): Promise<string[]> {
  const { data } = await apiGet<string[]>('/favorites/quote-ids');
  return data;
}

export async function addFavorite(quoteId: string): Promise<void> {
  await apiPost('/favorites', { quoteId });
}

export async function removeFavorite(quoteId: string): Promise<void> {
  await apiDelete(`/favorites/${quoteId}`);
}
