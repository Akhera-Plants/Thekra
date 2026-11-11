import { useQuery } from '@tanstack/react-query';
import { getPracticeEvidence } from '@/lib/api/practice';
import { evidenceBatches } from '@/lib/practice/moment-tools';
import { queryKeys } from '@/lib/query-keys';

const EVIDENCE_STALE_MS = 30 * 60 * 1000;

/**
 * Published quotes for a set of ids. The ids are sorted and asked in fixed batches of 50 (the API's cap), so the same
 * set always makes the same requests, whatever the member has chosen.
 */
export function usePracticeEvidence(ids: readonly string[], enabled = true) {
  const sorted = [...new Set(ids)].sort();
  const key = sorted.join(',');
  return useQuery({
    queryKey: queryKeys.practice.evidence(key),
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(evidenceBatches(sorted).map(async (batch) => (await getPracticeEvidence(batch, { signal })).data));
      return pages.flat();
    },
    enabled: enabled && sorted.length > 0,
    staleTime: EVIDENCE_STALE_MS,
  });
}
