/**
 * Admin Source API helpers.
 * Backend: POST/PATCH/DELETE /admin/sources
 * (GET /sources is used for listing)
 */
import { apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import type { QuoteSourceDto } from '@/lib/types/api';
import type { CreateSourceBody, UpdateSourceBody } from '@/lib/types/admin';

export async function adminCreateSource(
  body: CreateSourceBody,
): Promise<{ data: QuoteSourceDto }> {
  return apiPost<QuoteSourceDto>('/admin/sources', body);
}

export async function adminUpdateSource(
  id: string,
  body: UpdateSourceBody,
): Promise<{ data: QuoteSourceDto }> {
  return apiPatch<QuoteSourceDto>(`/admin/sources/${id}`, body);
}

export async function adminDeleteSource(id: string): Promise<void> {
  return apiDelete(`/admin/sources/${id}`);
}
