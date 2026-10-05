/**
 * Admin GoodDeed API helpers.
 * Backend: POST/PATCH/DELETE /admin/good-deeds
 */
import { apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import type { GoodDeedDto } from '@/lib/types/api';
import type { CreateGoodDeedBody, UpdateGoodDeedBody } from '@/lib/types/admin';

export async function adminCreateGoodDeed(
  body: CreateGoodDeedBody,
): Promise<{ data: GoodDeedDto }> {
  return apiPost<GoodDeedDto>('/admin/good-deeds', body);
}

export async function adminUpdateGoodDeed(
  id: string,
  body: UpdateGoodDeedBody,
): Promise<{ data: GoodDeedDto }> {
  return apiPatch<GoodDeedDto>(`/admin/good-deeds/${id}`, body);
}

export async function adminDeleteGoodDeed(id: string): Promise<void> {
  return apiDelete(`/admin/good-deeds/${id}`);
}
