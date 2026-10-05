import { useInfiniteQuery } from '@tanstack/react-query';
import { getQuotes } from '@/lib/api/quotes';
import { queryKeys } from '@/lib/query-keys';
import type { QuotesQuery } from '@/lib/types/api';

export function useQuoteSearch(params: QuotesQuery) {
  return useInfiniteQuery({
    queryKey: queryKeys.quotes.list(params),
    queryFn: ({ pageParam = 1 }) =>
      getQuotes({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasNext ? (lastPage.meta.page + 1) : undefined,
  });
}
