/**
 * Admin Sin API helpers.
 * Backend: POST/PATCH/DELETE /admin/sins
 * (GET /sins is used for listing)
 */
import { apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import type { SinDto } from '@/lib/types/api';
import type { CreateSinBody, UpdateSinBody } from '@/lib/types/admin';

export async function adminCreateSin(
  body: CreateSinBody,
): Promise<{ data: SinDto }> {
  return apiPost<SinDto>('/admin/sins', body);
}

export async function adminUpdateSin(
  id: string,
  body: UpdateSinBody,
): Promise<{ data: SinDto }> {
  return apiPatch<SinDto>(`/admin/sins/${id}`, body);
}

export async function adminDeleteSin(
  id: string,
  force = false,
): Promise<void> {
  return apiDelete(`/admin/sins/${id}`, { params: force ? { force: true } : undefined });
}
