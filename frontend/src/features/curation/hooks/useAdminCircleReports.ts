'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getCircleReports, setCircleReportStatus } from '@/lib/api/admin-circle-reports';
import { queryKeys } from '@/lib/query-keys';
import type { CircleReportStatusFilter } from '@/lib/types/admin';

const PAGE = 25;

/** The owner's list of reports, newest first, 25 at a time («أرني المزيد» asks for the next page). */
export function useCircleReports(status: CircleReportStatusFilter) {
  return useInfiniteQuery({
    queryKey: queryKeys.adminReview.circleReports({ status }),
    queryFn: ({ pageParam }) => getCircleReports({ status, limit: PAGE, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
}

/** How many reports wait for the owner (sidebar badge). One cheap request, kept warm for a few minutes. */
export function useOpenCircleReportCount() {
  return useQuery({
    queryKey: queryKeys.adminReview.circleReportsOpen,
    queryFn: async () => (await getCircleReports({ status: 'open', limit: 1 })).counts.open,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useSetCircleReportStatus() {
  const qc = useQueryClient();
  const t = useTranslations('admin.circleReports');
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CircleReportStatusFilter }) => setCircleReportStatus(id, status),
    onSuccess: (_data, { status }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminReview.all });
      toast.success(status === 'handled' ? t('handledToast') : t('reopenedToast'));
    },
    onError: () => toast.error(t('saveError')),
  });
}
