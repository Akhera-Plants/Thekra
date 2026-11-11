import { useQuery } from '@tanstack/react-query';
import { getQuote } from '@/lib/api/quotes';
import { queryKeys } from '@/lib/query-keys';
import type { QuoteDetailQuery } from '@/lib/types/api';

export function useQuote(id: string, query: QuoteDetailQuery = {}) {
  return useQuery({
    queryKey: queryKeys.quotes.detail(id),
    queryFn: () => getQuote(id, query),
    enabled: Boolean(id),
  });
}
