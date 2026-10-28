/**
 * Practice API: public catalog, evidence texts, the public occasions calendar, and (signed in) the synced
 * practice store, account export and account deletion.
 *
 * Privacy (roadmap §0.1): nothing about the sin program ever goes through this module except the request for
 * evidence texts, and that request always asks for the evidence of **all** catalog programs at once, so it is
 * the same request for every user and reveals no choice (see `useSinProgramEvidence`).
 */

import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import type { SyncPayload } from '@thekra/practice-core';
import { apiClient, apiDelete, apiGet, getApiBaseUrl } from '../api-client';
import { queryKeys } from '../query-keys';
import type { QuoteDto } from '../types/api';
import {
  allSinProgramEvidenceIds,
  type AccountExport,
  type CalendarOccasionDto,
  type PracticeCatalog,
  type PracticeVersion,
  type RemotePractice,
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

export async function getRemotePractice(): Promise<RemotePractice> {
  const res = await apiGet<RemotePractice>('/me/practice', { ...NO_LANG });
  return res.data;
}

/** The body must come from practice-core `exportForSync` (no `programs`). See practice/sync.ts. */
export async function putRemotePractice(body: { store: SyncPayload; version: PracticeVersion }) {
  const res = await apiClient.put<{ data: { version: PracticeVersion } }>('/me/practice', body, {
    ...NO_LANG,
  });
  return res.data.data;
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
