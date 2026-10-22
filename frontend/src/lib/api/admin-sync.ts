/**
 * Admin Content-Sync API helpers.
 * Backend:
 *   POST /admin/content-sync/runs  (#58)
 *   GET  /admin/sync-logs          (#59)
 *   GET  /admin/sync-logs/:id      (#60)
 */
import type { AxiosRequestConfig } from 'axios';
import { apiGet, apiPost } from '@/lib/api-client';

/** These routes whitelist their query: the client's auto `lang` param would be a 400. */
const NO_LANG = { skipLang: true } as AxiosRequestConfig;
import type { PageMeta } from '@/lib/types/api';
import type {
  SyncLogDto,
  TriggerSyncBody,
  SyncLogsQuery,
} from '@/lib/types/admin';

export async function adminTriggerSync(
  body: TriggerSyncBody,
): Promise<{ data: SyncLogDto }> {
  return apiPost<SyncLogDto>('/admin/content-sync/runs', body);
}

export async function adminListSyncLogs(
  query: SyncLogsQuery = {},
): Promise<{ data: SyncLogDto[]; meta?: PageMeta }> {
  return apiGet<SyncLogDto[]>('/admin/sync-logs', { ...NO_LANG, params: query });
}

export async function adminGetSyncLog(
  id: string,
): Promise<{ data: SyncLogDto }> {
  return apiGet<SyncLogDto>(`/admin/sync-logs/${id}`, NO_LANG);
}
