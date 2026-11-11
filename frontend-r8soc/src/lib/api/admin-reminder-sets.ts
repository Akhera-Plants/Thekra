/**
 * The curation desk's «مجموعات التذكير».
 * Backend: GET/POST /admin/reminder-sets, GET/PATCH/DELETE /admin/reminder-sets/:id, PUT /admin/reminder-sets/:id/items.
 * Items: only published Quran verses and sahih/hasan hadith (422 `REMINDER_SET_QUOTE_NOT_ALLOWED` otherwise).
 */
import { apiClient, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type { AdminReminderSetDto, ApiEnvelope } from '@/lib/types/api';

export interface ReminderSetBody {
  slug: string;
  titleAr: string;
  titleEn: string;
  sortOrder?: number;
  published?: boolean;
}

export async function adminListReminderSets(): Promise<AdminReminderSetDto[]> {
  return (await apiGet<AdminReminderSetDto[]>('/admin/reminder-sets')).data;
}

export async function adminGetReminderSet(id: string): Promise<AdminReminderSetDto> {
  return (await apiGet<AdminReminderSetDto>(`/admin/reminder-sets/${id}`)).data;
}

export async function adminCreateReminderSet(body: ReminderSetBody): Promise<AdminReminderSetDto> {
  return (await apiPost<AdminReminderSetDto>('/admin/reminder-sets', body)).data;
}

export async function adminUpdateReminderSet(id: string, body: Partial<ReminderSetBody>): Promise<AdminReminderSetDto> {
  return (await apiPatch<AdminReminderSetDto>(`/admin/reminder-sets/${id}`, body)).data;
}

export async function adminSetReminderSetItems(id: string, quoteIds: string[]): Promise<AdminReminderSetDto> {
  const response = await apiClient.put<ApiEnvelope<AdminReminderSetDto>>(`/admin/reminder-sets/${id}/items`, { quoteIds });
  return response.data.data;
}

export async function adminDeleteReminderSet(id: string): Promise<void> {
  return apiDelete(`/admin/reminder-sets/${id}`);
}
