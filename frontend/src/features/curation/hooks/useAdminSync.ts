'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { queryKeys } from '@/lib/query-keys';
import {
  adminTriggerSync,
  adminListSyncLogs,
  adminGetSyncLog,
} from '@/lib/api/admin-sync';
import type { TriggerSyncBody, SyncLogsQuery } from '@/lib/types/admin';

export function useAdminSyncLogs(query: SyncLogsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminSyncLogs.list(query),
    queryFn: () => adminListSyncLogs(query),
    refetchInterval: 5_000, // poll while a run might be in progress
  });
}

export function useAdminSyncLog(id: string) {
  return useQuery({
    queryKey: queryKeys.adminSyncLogs.detail(id),
    queryFn: () => adminGetSyncLog(id),
    enabled: !!id,
  });
}

export function useAdminTriggerSync() {
  const qc = useQueryClient();
  const t = useTranslations('admin');

  return useMutation({
    mutationFn: (body: TriggerSyncBody) => adminTriggerSync(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminSyncLogs.all });
      toast.success(t('sync.triggerSuccess'));
    },
    onError: () => toast.error(t('sync.triggerError')),
  });
}
