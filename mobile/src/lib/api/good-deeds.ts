import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type {
  GoodDeedDto,
  GoodDeedsQuery,
  GoodDeedQuotesQuery,
  GoodDeedQuotesResponse,
  GoodDeedQuotesMeta,
} from '../types/api';

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchGoodDeeds(params: GoodDeedsQuery = {}) {
  return apiGet<GoodDeedDto[]>('/good-deeds', { params });
}

export async function fetchGoodDeed(slug: string, lang?: string) {
  return apiGet<GoodDeedDto>(`/good-deeds/${slug}`, {
    params: lang ? { lang } : undefined,
  });
}

export async function fetchGoodDeedQuotes(slug: string, params: GoodDeedQuotesQuery = {}) {
  return apiGet<GoodDeedQuotesResponse>(`/good-deeds/${slug}/quotes`, { params });
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useGoodDeeds(params: GoodDeedsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.goodDeeds.list(params),
    queryFn: () => fetchGoodDeeds(params),
    select: (r) => r.data,
  });
}

export function useGoodDeed(slug: string, params: { lang?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.goodDeeds.detail(slug),
    queryFn: () => fetchGoodDeed(slug, params.lang),
    enabled: Boolean(slug),
    select: (r) => r.data,
  });
}

export function useGoodDeedQuotes(slug: string, params: GoodDeedQuotesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.goodDeeds.quotes(slug, params),
    queryFn: () => fetchGoodDeedQuotes(slug, params),
    enabled: Boolean(slug),
    select: (r) => ({ ...r.data, meta: r.meta as GoodDeedQuotesMeta | undefined }),
  });
}

export function useGoodDeedQuotesInfinite(slug: string, baseParams: GoodDeedQuotesQuery = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.goodDeeds.quotes(slug, baseParams),
    queryFn: ({ pageParam = 1 }) =>
      fetchGoodDeedQuotes(slug, { ...baseParams, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta as GoodDeedQuotesMeta | undefined;
      return meta?.hasNext ? (meta.page ?? 1) + 1 : undefined;
    },
    enabled: Boolean(slug),
  });
}
