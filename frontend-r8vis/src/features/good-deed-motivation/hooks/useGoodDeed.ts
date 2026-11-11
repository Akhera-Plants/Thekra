import { useQuery } from '@tanstack/react-query';
import { getGoodDeed } from '@/lib/api/good-deeds';
import { queryKeys } from '@/lib/query-keys';
import type { LocaleCode } from '@/lib/types/enums';

export function useGoodDeed(slug: string, lang?: LocaleCode) {
  return useQuery({
    queryKey: queryKeys.goodDeeds.detail(slug),
    queryFn: () => getGoodDeed(slug, lang),
    enabled: Boolean(slug),
  });
}
