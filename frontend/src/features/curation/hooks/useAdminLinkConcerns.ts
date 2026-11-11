'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { decideLinkConcern, getLinkConcerns, type LinkConcernsQuery } from '@/lib/api/admin-link-concerns';
import { queryKeys } from '@/lib/query-keys';
import type { LinkConcernKind } from '@/lib/types/admin';

export function useLinkConcerns(query: LinkConcernsQuery) {
  return useQuery({
    queryKey: queryKeys.adminReview.linkConcerns(query),
    queryFn: () => getLinkConcerns(query),
    placeholderData: keepPreviousData,
  });
}

/** «أبقِ الربط» / «اخفِ الربط» (and «أعده» for a hidden link, which is the same as keeping it). */
export function useDecideLinkConcern() {
  const qc = useQueryClient();
  const t = useTranslations('admin.linkConcerns');
  return useMutation({
    mutationFn: ({ kind, linkId, decision }: { kind: LinkConcernKind; linkId: string; decision: 'keep' | 'hide' }) =>
      decideLinkConcern(kind, linkId, decision),
    onSuccess: (_data, { decision }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminReview.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminSinQuotes.all });
      void qc.invalidateQueries({ queryKey: queryKeys.adminGoodDeedQuotes.all });
      toast.success(decision === 'keep' ? t('keptToast') : t('hiddenToast'));
    },
    onError: () => toast.error(t('saveError')),
  });
}
