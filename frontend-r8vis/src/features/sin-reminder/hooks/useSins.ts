import { useQuery } from '@tanstack/react-query';
import { getSins } from '@/lib/api/sins';
import { queryKeys } from '@/lib/query-keys';
import type { SinsQuery } from '@/lib/types/api';

export function useSins(params: SinsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.sins.list(params),
    queryFn: () => getSins(params),
  });
}
