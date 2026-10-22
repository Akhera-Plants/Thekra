import { useQuery } from '@tanstack/react-query';
import { getHadithCollections } from '@/lib/api/hadith';
import { queryKeys } from '@/lib/query-keys';

export function useHadithCollections() {
  return useQuery({
    queryKey: queryKeys.hadithCollections.all,
    queryFn: getHadithCollections,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
