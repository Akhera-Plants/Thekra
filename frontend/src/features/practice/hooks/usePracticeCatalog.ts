import { useQuery } from '@tanstack/react-query';
import { getPracticeCatalog } from '@/lib/api/practice';
import { queryKeys } from '@/lib/query-keys';

/** Catalog changes only with a content release: keep it for the session. */
const CATALOG_STALE_MS = 60 * 60 * 1000;

export function usePracticeCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.practice.catalog,
    queryFn: async ({ signal }) => (await getPracticeCatalog({ signal })).data,
    staleTime: CATALOG_STALE_MS,
    enabled,
  });
}
