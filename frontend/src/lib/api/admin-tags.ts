/**
 * Admin Tag API helpers.
 * Backend: POST/PATCH/DELETE /admin/tags
 * (GET /tags is used for listing)
 */
import { apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import type { QuoteTagDto } from '@/lib/types/api';
import type { CreateTagBody, UpdateTagBody } from '@/lib/types/admin';

export async function adminCreateTag(
  body: CreateTagBody,
): Promise<{ data: QuoteTagDto }> {
  return apiPost<QuoteTagDto>('/admin/tags', body);
}

export async function adminUpdateTag(
  id: string,
  body: UpdateTagBody,
): Promise<{ data: QuoteTagDto }> {
  return apiPatch<QuoteTagDto>(`/admin/tags/${id}`, body);
}

export async function adminDeleteTag(id: string): Promise<void> {
  return apiDelete(`/admin/tags/${id}`);
}
