import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type {
  BranchQuotesMeta,
  BranchQuotesQuery,
  BranchQuotesResponse,
  BranchesQuery,
  ImanBranchDetailDto,
  ImanBranchDto,
} from '../types/api';
import type { LocaleCode } from '../types/enums';

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchBranches(params: BranchesQuery = {}) {
  return apiGet<ImanBranchDto[]>('/branches', { params });
}

export async function fetchBranch(number: number, lang: LocaleCode) {
  return apiGet<ImanBranchDetailDto>(`/branches/${number}`, { params: { lang } });
}

export async function fetchBranchQuotes(number: number, params: BranchQuotesQuery = {}) {
  return apiGet<BranchQuotesResponse>(`/branches/${number}/quotes`, { params });
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useApiLang(): LocaleCode {
  const { i18n } = useTranslation();
  return i18n.language === 'en' ? 'en' : 'ar';
}

/** The 77 branches in their order (the API sorts by number). */
export function useBranches(params: BranchesQuery = {}) {
  const lang = useApiLang();
  return useQuery({
    queryKey: queryKeys.branches.list(params, lang),
    queryFn: () => fetchBranches({ ...params, lang }),
    select: (r) => r.data,
  });
}

/** One branch with the book's words on it and its neighbours («السابقة» / «التالية»). */
export function useBranch(number: number) {
  const lang = useApiLang();
  return useQuery({
    queryKey: queryKeys.branches.detail(number, lang),
    queryFn: () => fetchBranch(number, lang),
    enabled: number > 0,
    select: (r) => r.data,
  });
}

export function useBranchQuotesInfinite(number: number, baseParams: BranchQuotesQuery = {}) {
  const lang = useApiLang();
  return useInfiniteQuery({
    queryKey: queryKeys.branches.quotes(number, baseParams, lang),
    queryFn: ({ pageParam }) => fetchBranchQuotes(number, { ...baseParams, lang, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta as BranchQuotesMeta | undefined;
      return meta?.hasNext ? (meta.page ?? 1) + 1 : undefined;
    },
    enabled: number > 0,
  });
}
