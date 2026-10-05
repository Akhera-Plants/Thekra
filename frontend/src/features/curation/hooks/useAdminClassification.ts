'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { queryKeys } from '@/lib/query-keys';
import {
  adminListSinQuotes,
  adminLinkSinQuote,
  adminUpdateSinLink,
  adminUnlinkSinQuote,
  adminBulkLinkSinQuotes,
  adminListGoodDeedQuotes,
  adminLinkGoodDeedQuote,
  adminUnlinkGoodDeedQuote,
  adminBulkLinkGoodDeedQuotes,
} from '@/lib/api/admin-classification';
import type {
  SinQuotesAdminQuery,
  GoodDeedQuotesAdminQuery,
  BulkLinkSinQuotesBody,
  BulkLinkGoodDeedQuotesBody,
} from '@/lib/types/admin';

// ── Sin-Quote ─────────────────────────────────────────────────────────────────

export function useAdminSinQuotes(query: SinQuotesAdminQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminSinQuotes.list(query),
    queryFn: () => adminListSinQuotes(query),
    enabled: !!query.sinId,
  });
}

export function useAdminLinkSinQuote() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: adminLinkSinQuote,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminSinQuotes.all });
      toast.success(t('linking.linkSuccess'));
    },
    onError: () => toast.error(t('linking.linkError')),
  });
}

export function useAdminUpdateSinLink() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { relevanceScore?: number; note?: string } }) =>
      adminUpdateSinLink(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminSinQuotes.all });
      toast.success(t('linking.updateSuccess'));
    },
    onError: () => toast.error(t('linking.updateError')),
  });
}

export function useAdminUnlinkSinQuote() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: adminUnlinkSinQuote,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminSinQuotes.all });
      toast.success(t('linking.unlinkSuccess'));
    },
    onError: () => toast.error(t('linking.unlinkError')),
  });
}

export function useAdminBulkLinkSinQuotes() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (body: BulkLinkSinQuotesBody) => adminBulkLinkSinQuotes(body),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminSinQuotes.all });
      const { created, updated } = result.data;
      toast.success(t('linking.bulkSuccess', { created, updated }));
    },
    onError: () => toast.error(t('linking.bulkError')),
  });
}

// ── GoodDeed-Quote ────────────────────────────────────────────────────────────

export function useAdminGoodDeedQuotes(query: GoodDeedQuotesAdminQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminGoodDeedQuotes.list(query),
    queryFn: () => adminListGoodDeedQuotes(query),
    enabled: !!query.goodDeedId,
  });
}

export function useAdminLinkGoodDeedQuote() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: adminLinkGoodDeedQuote,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminGoodDeedQuotes.all });
      toast.success(t('linking.linkSuccess'));
    },
    onError: () => toast.error(t('linking.linkError')),
  });
}

export function useAdminUnlinkGoodDeedQuote() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: adminUnlinkGoodDeedQuote,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminGoodDeedQuotes.all });
      toast.success(t('linking.unlinkSuccess'));
    },
    onError: () => toast.error(t('linking.unlinkError')),
  });
}

export function useAdminBulkLinkGoodDeedQuotes() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (body: BulkLinkGoodDeedQuotesBody) => adminBulkLinkGoodDeedQuotes(body),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminGoodDeedQuotes.all });
      const { created, updated } = result.data;
      toast.success(t('linking.bulkSuccess', { created, updated }));
    },
    onError: () => toast.error(t('linking.bulkError')),
  });
}
