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

/** One saved text as `GET /v1/favorites` returns it: the favorite row with its quote inside (backend FavoritesService). */
export interface FavoriteRowDto {
  id: string;
  createdAt: string;
  quote: QuoteDto;
}

/**
 * The saved texts, newest first. The API sends favorite rows (`{ id, createdAt, quote }`), not bare quotes: the list
 * unwraps them. Reading a row as a quote is what broke «المحفوظات» with «خطأ غير متوقع» as soon as anything was saved
 * (owner round 7, B10).
 */
export async function getFavorites(
  params?: FavoritesQuery,
): Promise<FavoritesResponse> {
  const { data, meta } = await apiGet<Array<FavoriteRowDto | QuoteDto>>('/favorites', { params });
  const items = (data ?? [])
    .map((row) => ('quote' in row && row.quote ? row.quote : (row as QuoteDto)))
    .filter((quote): quote is QuoteDto => Boolean(quote?.type));
  return { items, meta: meta! };
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
