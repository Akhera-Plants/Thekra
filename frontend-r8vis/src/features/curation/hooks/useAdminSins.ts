'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { queryKeys } from '@/lib/query-keys';
import {
  adminCreateSin,
  adminUpdateSin,
  adminDeleteSin,
} from '@/lib/api/admin-sins';
import type { CreateSinBody, UpdateSinBody } from '@/lib/types/admin';

export function useAdminCreateSin() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (body: CreateSinBody) => adminCreateSin(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sins.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminSins.all });
      toast.success(t('sins.createSuccess'));
    },
    onError: () => toast.error(t('sins.createError')),
  });
}

export function useAdminUpdateSin() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSinBody }) =>
      adminUpdateSin(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sins.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminSins.all });
      toast.success(t('sins.updateSuccess'));
    },
    onError: () => toast.error(t('sins.updateError')),
  });
}

export function useAdminDeleteSin() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      adminDeleteSin(id, force),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sins.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminSins.all });
      toast.success(t('sins.deleteSuccess'));
    },
    onError: () => toast.error(t('sins.deleteError')),
  });
}
