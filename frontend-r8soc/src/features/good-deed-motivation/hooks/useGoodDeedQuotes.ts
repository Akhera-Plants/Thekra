import { useQuery } from '@tanstack/react-query';
import { getGoodDeedQuotes } from '@/lib/api/good-deeds';
import { queryKeys } from '@/lib/query-keys';
import type { GoodDeedQuotesQuery } from '@/lib/types/api';

export function useGoodDeedQuotes(
  slug: string,
  params: GoodDeedQuotesQuery = {},
) {
  return useQuery({
    queryKey: queryKeys.goodDeeds.quotes(slug, params),
    queryFn: () => getGoodDeedQuotes(slug, params),
    enabled: Boolean(slug),
  });
}
