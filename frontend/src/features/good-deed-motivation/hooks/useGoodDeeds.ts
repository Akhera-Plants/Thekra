import { useQuery } from '@tanstack/react-query';
import { getGoodDeeds } from '@/lib/api/good-deeds';
import { queryKeys } from '@/lib/query-keys';
import type { GoodDeedsQuery } from '@/lib/types/api';

export function useGoodDeeds(params: GoodDeedsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.goodDeeds.list(params),
    queryFn: () => getGoodDeeds(params),
  });
}
