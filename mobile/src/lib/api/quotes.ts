import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type { QuoteDetailDto, QuotesQuery, PageMeta } from '../types/api';

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchQuote(id: string, lang?: string) {
  return apiGet<QuoteDetailDto>(`/quotes/${id}`, {
    params: lang ? { lang, includeAllTranslations: true } : { includeAllTranslations: true },
  });
}

export async function fetchQuotes(params: QuotesQuery = {}) {
  return apiGet<QuoteDetailDto[]>('/quotes', { params });
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useQuote(id: string, params: { lang?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.quotes.detail(id),
    queryFn: () => fetchQuote(id, params.lang),
    enabled: Boolean(id),
    select: (r) => r.data,
  });
}

export function useQuotes(params: QuotesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.quotes.list(params),
    queryFn: () => fetchQuotes(params),
    select: (r) => r,
  });
}

export function useQuotesInfinite(baseParams: QuotesQuery = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.quotes.list(baseParams),
    queryFn: ({ pageParam = 1 }) => fetchQuotes({ ...baseParams, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta as PageMeta | undefined;
      return meta?.hasNext ? (meta.page ?? 1) + 1 : undefined;
    },
  });
}
