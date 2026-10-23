import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isCancellation, reportFailure } from '@/lib/errors';
import { ApiError } from '@/lib/types/api';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isCancellation(error)) return false;
  if (error instanceof ApiError) {
    // One more try for a dropped connection or a slow answer (a retry after a
    // 10 s timeout must not hold the loader for half a minute); two for a 5xx; none for a 4xx.
    if (error.kind === 'network' || error.kind === 'timeout') return failureCount < 1;
    return error.status >= 500 && failureCount < 2;
  }
  return false;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    // Fires once per failed fetch (after retries), not per render or per observer.
    queryCache: new QueryCache({
      onError: (error, query) => reportFailure(`query ${JSON.stringify(query.queryKey).slice(0, 120)}`, error),
    }),
    mutationCache: new MutationCache({
      onError: (error) => reportFailure('mutation', error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 300_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
