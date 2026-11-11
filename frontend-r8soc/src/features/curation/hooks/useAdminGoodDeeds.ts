'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { queryKeys } from '@/lib/query-keys';
import {
  adminCreateGoodDeed,
  adminUpdateGoodDeed,
  adminDeleteGoodDeed,
} from '@/lib/api/admin-good-deeds';
import type { CreateGoodDeedBody, UpdateGoodDeedBody } from '@/lib/types/admin';

export function useAdminCreateGoodDeed() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (body: CreateGoodDeedBody) => adminCreateGoodDeed(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.goodDeeds.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminGoodDeeds.all });
      toast.success(t('goodDeeds.createSuccess'));
    },
    onError: () => toast.error(t('goodDeeds.createError')),
  });
}

export function useAdminUpdateGoodDeed() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGoodDeedBody }) =>
      adminUpdateGoodDeed(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.goodDeeds.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminGoodDeeds.all });
      toast.success(t('goodDeeds.updateSuccess'));
    },
    onError: () => toast.error(t('goodDeeds.updateError')),
  });
}

export function useAdminDeleteGoodDeed() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (id: string) => adminDeleteGoodDeed(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.goodDeeds.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminGoodDeeds.all });
      toast.success(t('goodDeeds.deleteSuccess'));
    },
    onError: () => toast.error(t('goodDeeds.deleteError')),
  });
}
