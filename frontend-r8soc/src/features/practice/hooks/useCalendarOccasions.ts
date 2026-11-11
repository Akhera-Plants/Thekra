import { useQuery } from '@tanstack/react-query';
import { getCalendarOccasions } from '@/lib/api/practice';
import { queryKeys } from '@/lib/query-keys';
import type { OccasionsQuery } from '@/lib/types/practice';

export function useCalendarOccasions(query: OccasionsQuery | null) {
  return useQuery({
    queryKey: queryKeys.practice.occasions(query ?? { from: '', to: '', hijriOffset: 0 }),
    queryFn: async ({ signal }) => (await getCalendarOccasions(query as OccasionsQuery, { signal })).data,
    enabled: query !== null,
    staleTime: 60 * 60 * 1000,
  });
}
