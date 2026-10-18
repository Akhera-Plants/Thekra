/**
 * Review desk API helpers (existing backend routes, no contract changes).
 * Backend: GET /review/flags, GET /review/flags/:id,
 *          POST /review/flags/:id/{resolve,dismiss}, POST /review/matches/:id/{confirm,reject}.
 * Counts use the list endpoints with limit=1 and read meta.total — no stats endpoint exists.
 */
import type { AxiosRequestConfig } from 'axios';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type { PageMeta } from '@/lib/types/api';
import type {
  AdminQuotesQuery,
  FlagDetailDto,
  FlagDto,
  FlagsQuery,
  GoodDeedQuoteLinkDto,
  ProposedLinkDto,
  SinQuoteLinkDto,
} from '@/lib/types/admin';
import type { LinkReviewStatus } from '@/lib/types/enums';

export async function getFlags(query: FlagsQuery): Promise<{ data: FlagDto[]; meta?: PageMeta }> {
  return apiGet<FlagDto[]>('/review/flags', { params: query });
}

export async function getFlag(id: string): Promise<{ data: FlagDetailDto }> {
  return apiGet<FlagDetailDto>(`/review/flags/${id}`);
}

export type FlagAction =
  | { kind: 'resolve' | 'dismiss'; flagId: string; note?: string }
  | { kind: 'confirm' | 'reject'; matchId: string; note?: string };

export async function runFlagAction(action: FlagAction): Promise<void> {
  const body = { note: action.note?.trim() || undefined };
  const path =
    'flagId' in action
      ? `/review/flags/${action.flagId}/${action.kind}`
      : `/review/matches/${action.matchId}/${action.kind}`;
  await apiPost(path, body);
}

async function totalOf(path: string, params: object, skipLang = false): Promise<number> {
  const config = { params: { ...params, page: 1, limit: 1 }, skipLang } as AxiosRequestConfig;
  const result = await apiGet<unknown[]>(path, config);
  return result.meta?.total ?? 0;
}

export function countFlags(query: Omit<FlagsQuery, 'page' | 'limit'>): Promise<number> {
  return totalOf('/review/flags', query);
}

export function countAdminQuotes(
  query: Omit<AdminQuotesQuery, 'page' | 'limit'>,
): Promise<number> {
  return totalOf('/admin/quotes', query);
}

export function countLinks(
  kind: 'sin' | 'good-deed',
  query: { reviewStatus?: LinkReviewStatus },
): Promise<number> {
  return totalOf(kind === 'sin' ? '/admin/sin-quotes' : '/admin/good-deed-quotes', query, true);
}

export async function getProposedLinks(
  kind: 'sin' | 'good-deed',
  query: { page?: number; limit?: number; reviewStatus?: LinkReviewStatus; sort?: 'score' | 'newest' },
): Promise<{ data: ProposedLinkDto[]; meta?: PageMeta }> {
  return apiGet<ProposedLinkDto[]>(kind === 'sin' ? '/admin/sin-quotes' : '/admin/good-deed-quotes', {
    params: query,
    skipLang: true,
  } as AxiosRequestConfig);
}

/** PATCH the link's reviewStatus (UpdateSinLinkDto / UpdateGoodDeedLinkDto already accept it). */
export async function setLinkReviewStatus(
  kind: 'sin' | 'good-deed',
  id: string,
  reviewStatus: LinkReviewStatus,
): Promise<void> {
  if (kind === 'sin') await apiPatch<SinQuoteLinkDto>(`/admin/sin-quotes/${id}`, { reviewStatus });
  else await apiPatch<GoodDeedQuoteLinkDto>(`/admin/good-deed-quotes/${id}`, { reviewStatus });
}
