/**
 * Admin Quote API helpers.
 * Backend: POST/GET/PATCH/DELETE /admin/quotes
 *          PUT/POST/DELETE /admin/quotes/:id/translations/:lang
 *          PUT /admin/quotes/:id/tags
 */
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from '@/lib/api-client';
import type { QuoteDto, PageMeta } from '@/lib/types/api';
import type {
  AdminQuotesQuery,
  CreateQuoteBody,
  UpdateQuoteBody,
  AdminTranslationDto,
} from '@/lib/types/admin';

export interface AdminQuotesResult {
  data: QuoteDto[];
  meta?: PageMeta;
}

export async function adminGetQuotes(
  query: AdminQuotesQuery = {},
): Promise<AdminQuotesResult> {
  return apiGet<QuoteDto[]>('/admin/quotes', { params: query });
}

export async function adminGetQuote(id: string): Promise<{ data: QuoteDto }> {
  return apiGet<QuoteDto>(`/admin/quotes/${id}`, {
    params: { includeAllTranslations: true },
  });
}

export async function adminCreateQuote(
  body: CreateQuoteBody,
): Promise<{ data: QuoteDto }> {
  return apiPost<QuoteDto>('/admin/quotes', body);
}

export async function adminUpdateQuote(
  id: string,
  body: UpdateQuoteBody,
): Promise<{ data: QuoteDto }> {
  return apiPatch<QuoteDto>(`/admin/quotes/${id}`, body);
}

export async function adminDeleteQuote(id: string): Promise<void> {
  return apiDelete(`/admin/quotes/${id}`);
}

// ── Translations ──────────────────────────────────────────────────────────────

export async function adminUpsertTranslation(
  quoteId: string,
  languageCode: string,
  text: string,
): Promise<{ data: AdminTranslationDto }> {
  return apiPatch<AdminTranslationDto>(
    `/admin/quotes/${quoteId}/translations/${languageCode}`,
    { text },
  );
}

export async function adminDeleteTranslation(
  quoteId: string,
  languageCode: string,
): Promise<void> {
  return apiDelete(`/admin/quotes/${quoteId}/translations/${languageCode}`);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function adminSetQuoteTags(
  quoteId: string,
  tagIds: string[],
): Promise<void> {
  await apiPost(`/admin/quotes/${quoteId}/tags`, { tagIds });
}
