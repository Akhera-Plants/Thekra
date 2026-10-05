/**
 * Admin Classification API helpers.
 * Backend:
 *   POST/GET/PATCH/DELETE /admin/sin-quotes
 *   POST /admin/sin-quotes/bulk
 *   POST/GET/PATCH/DELETE /admin/good-deed-quotes
 *   POST /admin/good-deed-quotes/bulk
 */
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type {
  SinQuoteLinkDto,
  GoodDeedQuoteLinkDto,
  SinQuotesAdminQuery,
  GoodDeedQuotesAdminQuery,
  BulkLinkSinQuotesBody,
  BulkLinkGoodDeedQuotesBody,
  BulkLinkResult,
} from '@/lib/types/admin';
import type { PageMeta } from '@/lib/types/api';

// ── Sin-Quote links ───────────────────────────────────────────────────────────

export async function adminListSinQuotes(
  query: SinQuotesAdminQuery = {},
): Promise<{ data: SinQuoteLinkDto[]; meta?: PageMeta }> {
  return apiGet<SinQuoteLinkDto[]>('/admin/sin-quotes', { params: query });
}

export async function adminLinkSinQuote(body: {
  sinId: string;
  quoteId: string;
  relevanceScore?: number;
  note?: string;
}): Promise<{ data: SinQuoteLinkDto }> {
  return apiPost<SinQuoteLinkDto>('/admin/sin-quotes', body);
}

export async function adminUpdateSinLink(
  id: string,
  body: { relevanceScore?: number; note?: string },
): Promise<{ data: SinQuoteLinkDto }> {
  return apiPatch<SinQuoteLinkDto>(`/admin/sin-quotes/${id}`, body);
}

export async function adminUnlinkSinQuote(id: string): Promise<void> {
  return apiDelete(`/admin/sin-quotes/${id}`);
}

export async function adminBulkLinkSinQuotes(
  body: BulkLinkSinQuotesBody,
): Promise<{ data: BulkLinkResult }> {
  return apiPost<BulkLinkResult>('/admin/sin-quotes/bulk', body);
}

// ── GoodDeed-Quote links ──────────────────────────────────────────────────────

export async function adminListGoodDeedQuotes(
  query: GoodDeedQuotesAdminQuery = {},
): Promise<{ data: GoodDeedQuoteLinkDto[]; meta?: PageMeta }> {
  return apiGet<GoodDeedQuoteLinkDto[]>('/admin/good-deed-quotes', { params: query });
}

export async function adminLinkGoodDeedQuote(body: {
  goodDeedId: string;
  quoteId: string;
  relevanceScore?: number;
  note?: string;
}): Promise<{ data: GoodDeedQuoteLinkDto }> {
  return apiPost<GoodDeedQuoteLinkDto>('/admin/good-deed-quotes', body);
}

export async function adminUpdateGoodDeedLink(
  id: string,
  body: { relevanceScore?: number; note?: string },
): Promise<{ data: GoodDeedQuoteLinkDto }> {
  return apiPatch<GoodDeedQuoteLinkDto>(`/admin/good-deed-quotes/${id}`, body);
}

export async function adminUnlinkGoodDeedQuote(id: string): Promise<void> {
  return apiDelete(`/admin/good-deed-quotes/${id}`);
}

export async function adminBulkLinkGoodDeedQuotes(
  body: BulkLinkGoodDeedQuotesBody,
): Promise<{ data: BulkLinkResult }> {
  return apiPost<BulkLinkResult>('/admin/good-deed-quotes/bulk', body);
}
