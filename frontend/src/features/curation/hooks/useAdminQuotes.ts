'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { queryKeys } from '@/lib/query-keys';
import {
  adminGetQuotes,
  adminGetQuote,
  adminCreateQuote,
  adminUpdateQuote,
  adminDeleteQuote,
  adminUpsertTranslation,
  adminDeleteTranslation,
  adminSetQuoteTags,
} from '@/lib/api/admin-quotes';
import type { AdminQuotesQuery, CreateQuoteBody, UpdateQuoteBody } from '@/lib/types/admin';

export function useAdminQuotes(query: AdminQuotesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminQuotes.list(query),
    queryFn: () => adminGetQuotes(query),
  });
}

export function useAdminQuote(id: string) {
  return useQuery({
    queryKey: queryKeys.adminQuotes.detail(id),
    queryFn: () => adminGetQuote(id),
    enabled: !!id,
  });
}

export function useAdminCreateQuote() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (body: CreateQuoteBody) => adminCreateQuote(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminQuotes.all });
      toast.success(t('quotes.createSuccess'));
    },
    onError: () => toast.error(t('quotes.createError')),
  });
}

export function useAdminUpdateQuote(id: string) {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (body: UpdateQuoteBody) => adminUpdateQuote(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminQuotes.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminQuotes.detail(id) });
      toast.success(t('quotes.updateSuccess'));
    },
    onError: () => toast.error(t('quotes.updateError')),
  });
}

export function useAdminDeleteQuote() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (id: string) => adminDeleteQuote(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminQuotes.all });
      toast.success(t('quotes.deleteSuccess'));
    },
    onError: () => toast.error(t('quotes.deleteError')),
  });
}

export function useAdminUpsertTranslation(quoteId: string) {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: ({ languageCode, text }: { languageCode: string; text: string }) =>
      adminUpsertTranslation(quoteId, languageCode, text),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminQuotes.detail(quoteId) });
      toast.success(t('translations.saveSuccess'));
    },
    onError: () => toast.error(t('translations.saveError')),
  });
}

export function useAdminDeleteTranslation(quoteId: string) {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (languageCode: string) => adminDeleteTranslation(quoteId, languageCode),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminQuotes.detail(quoteId) });
      toast.success(t('translations.deleteSuccess'));
    },
    onError: () => toast.error(t('translations.deleteError')),
  });
}

export function useAdminSetQuoteTags(quoteId: string) {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (tagIds: string[]) => adminSetQuoteTags(quoteId, tagIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminQuotes.detail(quoteId) });
      toast.success(t('tags.saveSuccess'));
    },
    onError: () => toast.error(t('tags.saveError')),
  });
}
