'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import {
  countAdminQuotes,
  countFlags,
  countLinks,
  getFlag,
  getFlags,
  getProposedLinks,
  runFlagAction,
  setLinkReviewStatus,
  type FlagAction,
} from '@/lib/api/admin-review';
import { getQuote } from '@/lib/api/quotes';
import { ApiError } from '@/lib/types/api';
import type { FlagsQuery } from '@/lib/types/admin';
import type { LinkReviewStatus } from '@/lib/types/enums';

/** Counts change slowly and fan out; keep them warm for a few minutes and never retry. */
const COUNT_OPTIONS = { staleTime: 5 * 60_000, retry: false } as const;

// ── Flags ─────────────────────────────────────────────────────────────────────

export function useFlags(query: FlagsQuery) {
  return useQuery({
    queryKey: queryKeys.adminReview.flags(query),
    queryFn: () => getFlags(query),
    placeholderData: keepPreviousData,
  });
}

export function useFlagDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminReview.flag(id ?? ''),
    queryFn: () => getFlag(id ?? ''),
    enabled: !!id,
  });
}

export function useFlagAction() {
  const qc = useQueryClient();
  const t = useTranslations('admin.flagsDesk');
  return useMutation({
    mutationFn: (action: FlagAction) => runFlagAction(action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminReview.all });
      toast.success(t('done'));
    },
    onError: () => toast.error(t('actionError')),
  });
}

/**
 * Faceted counts: for each value of one dimension, the total under the other active filters.
 * One `limit=1` request per value; meta.total is the count. No stats endpoint exists.
 */
export function useFacetCounts<Q extends object>(
  scope: string,
  values: string[],
  build: (value: string) => Q,
  count: (query: Q) => Promise<number>,
) {
  const results = useQueries({
    queries: values.map((value) => {
      const query = build(value);
      return {
        queryKey: queryKeys.adminReview.count(scope, query),
        queryFn: () => count(query),
        ...COUNT_OPTIONS,
      };
    }),
  });
  const counts: Record<string, number | undefined> = {};
  values.forEach((value, index) => {
    counts[value] = results[index]?.data;
  });
  return {
    counts,
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
  };
}

export function useFlagCount(query: Omit<FlagsQuery, 'page' | 'limit'>) {
  return useQuery({
    queryKey: queryKeys.adminReview.count('flags', query),
    queryFn: () => countFlags(query),
    ...COUNT_OPTIONS,
  });
}

// ── Overview ──────────────────────────────────────────────────────────────────

export function useLinkCount(kind: 'sin' | 'good-deed', reviewStatus: LinkReviewStatus) {
  return useQuery({
    queryKey: queryKeys.adminReview.count(`links-${kind}`, { reviewStatus }),
    queryFn: () => countLinks(kind, { reviewStatus }),
    ...COUNT_OPTIONS,
  });
}

/** Per-source "graded" and "linked" counts for the library ledger (two count requests per source). */
export function useSourceLedgerCounts(sourceIds: string[]) {
  const graded = useQueries({
    queries: sourceIds.map((sourceId) => {
      const query = { sourceId, grades: ['SAHIH', 'HASAN', 'DAIF'] as const };
      return {
        queryKey: queryKeys.adminReview.count('quotes', query),
        queryFn: () => countAdminQuotes({ sourceId, grades: ['SAHIH', 'HASAN', 'DAIF'] }),
        ...COUNT_OPTIONS,
      };
    }),
  });
  const unlinked = useQueries({
    queries: sourceIds.map((sourceId) => {
      const query = { sourceId, unlinkedOnly: true };
      return {
        queryKey: queryKeys.adminReview.count('quotes', query),
        queryFn: () => countAdminQuotes(query),
        ...COUNT_OPTIONS,
      };
    }),
  });
  return sourceIds.map((sourceId, index) => ({
    sourceId,
    graded: graded[index],
    unlinked: unlinked[index],
  }));
}

// ── Publish probe ─────────────────────────────────────────────────────────────

export type PublicState = 'public' | 'hidden' | 'unknown';

/**
 * Is this text visible to readers? The public detail route applies the reader rule
 * (OCR verified, approved grade source, no open HIGH flag) and 404s otherwise — the
 * authoritative answer, since the admin DTO does not carry gradeSource or flags.
 */
export function usePublicState(quoteId: string | null) {
  return useQuery<PublicState>({
    queryKey: queryKeys.adminReview.publicState(quoteId ?? ''),
    enabled: !!quoteId,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      try {
        await getQuote(quoteId ?? '');
        return 'public';
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return 'hidden';
        return 'unknown';
      }
    },
  });
}

// ── Proposed links ────────────────────────────────────────────────────────────

export function useProposedLinks(kind: 'sin' | 'good-deed', page: number) {
  const query = { page, limit: 50, reviewStatus: 'NOT_REVIEWED' as const, sort: 'score' as const };
  return useQuery({
    queryKey: queryKeys.adminReview.proposals(kind, query),
    queryFn: () => getProposedLinks(kind, query),
    placeholderData: keepPreviousData,
  });
}

export function useSetLinkReviewStatus(kind: 'sin' | 'good-deed') {
  const qc = useQueryClient();
  const t = useTranslations('admin.proposals');
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACCEPTED' | 'REJECTED' }) =>
      setLinkReviewStatus(kind, id, status),
    onSuccess: (_data, { status }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminReview.all });
      void qc.invalidateQueries({ queryKey: kind === 'sin' ? queryKeys.adminSinQuotes.all : queryKeys.adminGoodDeedQuotes.all });
      toast.success(status === 'ACCEPTED' ? t('accepted') : t('rejected'));
    },
    onError: () => toast.error(t('error')),
  });
}
