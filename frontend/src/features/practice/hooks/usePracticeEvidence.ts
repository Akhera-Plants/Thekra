import { useQuery } from '@tanstack/react-query';
import { getPracticeEvidence } from '@/lib/api/practice';
import { queryKeys } from '@/lib/query-keys';

const EVIDENCE_STALE_MS = 30 * 60 * 1000;

/** Published quotes for a set of ids, in the order the ids are given. */
export function usePracticeEvidence(ids: readonly string[], enabled = true) {
  const sorted = [...new Set(ids)].sort();
  const key = sorted.join(',');
  return useQuery({
    queryKey: queryKeys.practice.evidence(key),
    queryFn: async ({ signal }) => (await getPracticeEvidence(sorted, { signal })).data,
    enabled: enabled && sorted.length > 0,
    staleTime: EVIDENCE_STALE_MS,
  });
}
