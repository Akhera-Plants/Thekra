'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { getExplanations } from '../api';
import { queryKeys } from '@/lib/query-keys';

export function useExplanations(quoteId: string | null, enabled: boolean) {
  const locale = useLocale();
  const lang = locale === 'en' ? 'en' : 'ar';
  return useQuery({
    queryKey: [...queryKeys.quotes.detail(quoteId ?? 'none'), 'explanations', lang] as const,
    queryFn: async () => {
      const res = await getExplanations(quoteId!, lang);
      return res.data;
    },
    enabled: Boolean(quoteId) && enabled,
    staleTime: 60_000,
  });
}
