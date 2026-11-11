import { useQuery } from '@tanstack/react-query';
import { getSins } from '@/lib/api/sins';
import { queryKeys } from '@/lib/query-keys';
import type { SinsQuery } from '@/lib/types/api';

/**
 * The whole public sin list (names by slug). The same request for every visitor, so choosing a program
 * never tells the server which sin it is about (roadmap §0.1).
 */
export function useSinNames(lang: 'ar' | 'en') {
  const params: SinsQuery = { limit: 100, lang };
  return useQuery({
    queryKey: queryKeys.sins.list(params),
    queryFn: async ({ signal }) => (await getSins(params, { signal })).data,
    staleTime: 60 * 60 * 1000,
  });
}
