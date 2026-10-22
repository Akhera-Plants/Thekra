import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type {
  SinDto,
  SinsQuery,
  SinQuotesQuery,
  SinQuotesResponse,
  SinQuotesMeta,
} from '../types/api';

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchSins(params: SinsQuery = {}) {
  return apiGet<SinDto[]>('/sins', { params });
}

export async function fetchSin(slug: string, lang?: string) {
  return apiGet<SinDto>(`/sins/${slug}`, { params: lang ? { lang } : undefined });
}

export async function fetchSinQuotes(slug: string, params: SinQuotesQuery = {}) {
  return apiGet<SinQuotesResponse>(`/sins/${slug}/quotes`, { params });
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useSins(params: SinsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.sins.list(params),
    queryFn: () => fetchSins(params),
    select: (r) => r.data,
  });
}

export function useSin(slug: string, params: { lang?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.sins.detail(slug),
    queryFn: () => fetchSin(slug, params.lang),
    enabled: Boolean(slug),
    select: (r) => r.data,
  });
}

export function useSinQuotes(slug: string, params: SinQuotesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.sins.quotes(slug, params),
    queryFn: () => fetchSinQuotes(slug, params),
    enabled: Boolean(slug),
    select: (r) => ({ ...r.data, meta: r.meta as SinQuotesMeta | undefined }),
  });
}

export function useSinQuotesInfinite(slug: string, baseParams: SinQuotesQuery = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.sins.quotes(slug, baseParams),
    queryFn: ({ pageParam = 1 }) =>
      fetchSinQuotes(slug, { ...baseParams, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta as SinQuotesMeta | undefined;
      return meta?.hasNext ? (meta.page ?? 1) + 1 : undefined;
    },
    enabled: Boolean(slug),
  });
}
