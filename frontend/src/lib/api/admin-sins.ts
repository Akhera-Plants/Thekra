/**
 * Admin Sin API helpers.
 * Backend: GET/POST/PATCH/DELETE /admin/sins
 */
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type { AdminSinDto, CreateSinBody, UpdateSinBody } from '@/lib/types/admin';
import type { SinsQuery } from '@/lib/types/api';

export async function adminListSins(query: SinsQuery = {}) {
  return apiGet<AdminSinDto[]>('/admin/sins', { params: query });
}

export async function adminCreateSin(
  body: CreateSinBody,
): Promise<{ data: AdminSinDto }> {
  return apiPost<AdminSinDto>('/admin/sins', body);
}

export async function adminUpdateSin(
  id: string,
  body: UpdateSinBody,
): Promise<{ data: AdminSinDto }> {
  return apiPatch<AdminSinDto>(`/admin/sins/${id}`, body);
}

export async function adminDeleteSin(
  id: string,
  force = false,
): Promise<void> {
  return apiDelete(`/admin/sins/${id}`, { params: force ? { force: true } : undefined });
}
