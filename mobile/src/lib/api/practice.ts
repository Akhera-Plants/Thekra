/**
 * Practice API: public catalog, evidence texts, the public occasions calendar, and (signed in) the practice
 * sync, the encrypted sin vault, account export and account deletion
 * (docs/plan/2026-10-practice-sync-contract.md §3).
 *
 * Privacy (roadmap §0.1): the sin program reaches the network only as vault ciphertext. The request for evidence
 * texts always asks for the evidence of **all** catalog programs at once, so it is the same request for every
 * user and reveals no choice (see `useSinProgramEvidence`).
 */

import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import type { SyncRequest, SyncResponse, VaultPayload } from '@thekra/practice-core';
import { apiClient, apiDelete, apiGet, apiPost, getApiBaseUrl } from '../api-client';
import { queryKeys } from '../query-keys';
import type { QuoteDto } from '../types/api';
import {
  allSinProgramEvidenceIds,
  type AccountExport,
  type CalendarOccasionDto,
  type PracticeCatalog,
  type RemoteVault,
  type UiLocale,
} from '../practice/catalog-types';

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchPracticeCatalog() {
  return apiGet<PracticeCatalog>('/practice/catalog');
}

export async function fetchEvidence(ids: readonly string[]) {
  return apiGet<QuoteDto[]>('/practice/evidence', { params: { ids: ids.join(',') } });
}

export async function fetchCalendarOccasions(from: string, to: string, hijriOffset: number) {
  return apiGet<CalendarOccasionDto[]>('/calendar/occasions', {
    params: { from, to, hijriOffset },
  });
}

/** `webcal://…/v1/calendar/occasions.ics?lang=…&months=12`: the public feed, the same for everyone. */
export function calendarSubscribeUrl(lang: UiLocale, months = 12): string {
  const base = getApiBaseUrl().replace(/^https?:\/\//i, 'webcal://');
  return `${base}/v1/calendar/occasions.ics?lang=${lang}&months=${months}`;
}

/** `skipLang` is a custom flag read by the api-client interceptor (no `?lang` on account calls). */
const NO_LANG = { skipLang: true } as unknown as AxiosRequestConfig;

/** `GET /v1/me/practice?since=` → the changes after `since` (everything when null). Contract §3. */
export async function getPracticeChanges(since: string | null): Promise<SyncResponse> {
  const res = await apiGet<SyncResponse>('/me/practice', { ...NO_LANG, params: since ? { since } : {} });
  return res.data;
}

/** `POST /v1/me/practice/sync`. The body comes from practice-core `buildSyncRequest` (never any program). */
export async function postPracticeSync(body: SyncRequest): Promise<SyncResponse> {
  const res = await apiPost<SyncResponse>('/me/practice/sync', body, { ...NO_LANG });
  return res.data;
}

/** The encrypted sin vault as stored on the server (opaque ciphertext), or null. */
export async function getSinVault(): Promise<RemoteVault | null> {
  const res = await apiGet<{ vault: RemoteVault | null }>('/me/sin-vault', { ...NO_LANG });
  return res.data.vault ?? null;
}

/** PUT the sealed vault (practice-core `vaultPayload`). 409 SIN_VAULT_CONFLICT carries the current vault. */
export async function putSinVault(body: VaultPayload): Promise<{ version: number }> {
  const res = await apiClient.put<{ data: { version: number } }>('/me/sin-vault', body, { ...NO_LANG });
  return res.data.data;
}

export async function deleteSinVault(): Promise<void> {
  await apiDelete('/me/sin-vault', { ...NO_LANG });
}

export async function deleteAccount(password: string): Promise<void> {
  await apiDelete('/auth/me', { data: { password }, ...NO_LANG });
}

export async function exportAccountData(): Promise<AccountExport> {
  const res = await apiGet<AccountExport>('/auth/me/export', { ...NO_LANG });
  return res.data;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

export function usePracticeCatalog(lang: string) {
  return useQuery({
    queryKey: queryKeys.practice.catalog(lang),
    queryFn: fetchPracticeCatalog,
    select: (r) => r.data,
    staleTime: DAY,
  });
}

/** Evidence texts by id. Unknown or unpublished ids are simply absent. */
export function useEvidence(ids: readonly string[], lang: string) {
  const sorted = [...new Set(ids)].sort();
  const key = sorted.join(',');
  return useQuery({
    queryKey: queryKeys.practice.evidence(key, lang),
    queryFn: () => fetchEvidence(sorted),
    enabled: sorted.length > 0,
    staleTime: DAY,
    select: (r) => {
      const byId = new Map<string, QuoteDto>();
      for (const q of r.data) byId.set(q.id, q);
      return byId;
    },
  });
}

/**
 * Evidence for the sin programs. Always requests the union of every program's ids, never one program's:
 * the request must not tell the server which sin the user picked (roadmap §0.1).
 */
export function useSinProgramEvidence(catalog: PracticeCatalog | undefined, lang: string) {
  return useEvidence(catalog ? allSinProgramEvidenceIds(catalog.sinPrograms) : [], lang);
}

export function useCalendarOccasions(from: string, to: string, hijriOffset: number, lang: string) {
  return useQuery({
    queryKey: queryKeys.calendar.occasions(from, to, hijriOffset, lang),
    queryFn: () => fetchCalendarOccasions(from, to, hijriOffset),
    select: (r) => r.data,
    staleTime: 6 * 60 * 60 * 1000,
  });
}
