import { useQuery } from '@tanstack/react-query';
import { getSin } from '@/lib/api/sins';
import { queryKeys } from '@/lib/query-keys';
import type { LocaleCode } from '@/lib/types/enums';

export function useSin(slug: string, lang?: LocaleCode) {
  return useQuery({
    queryKey: queryKeys.sins.detail(slug),
    queryFn: () => getSin(slug, lang),
    enabled: Boolean(slug),
  });
}
