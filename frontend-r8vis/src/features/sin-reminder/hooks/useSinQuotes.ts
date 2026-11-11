import { useQuery } from '@tanstack/react-query';
import { getSinQuotes } from '@/lib/api/sins';
import { queryKeys } from '@/lib/query-keys';
import type { SinQuotesQuery } from '@/lib/types/api';

export function useSinQuotes(slug: string, params: SinQuotesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.sins.quotes(slug, params),
    queryFn: () => getSinQuotes(slug, params),
    enabled: Boolean(slug),
  });
}
