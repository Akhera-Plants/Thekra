import { ApiError } from '@/lib/types/api';

/**
 * `fetch` to this app's own route handlers (`/api/auth/*`) with the failures that
 * matter normalised: no connection becomes `ApiError(kind: 'network')`, a body that
 * is not JSON becomes `json: null`. Callers decide what a non-2xx means.
 */
export async function fetchRouteJson<T>(
  input: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; json: T | null }> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (error) {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Request failed',
      status: 0,
      kind: 'network',
      endpoint: `${init.method ?? 'GET'} ${input}`,
      cause: error,
    });
  }
  const json = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status: res.status, json };
}
