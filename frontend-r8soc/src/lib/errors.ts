import axios from 'axios';
import { ApiError } from '@/lib/types/api';

/**
 * One vocabulary for every failure the visitor can see. Each key has a localised
 * message in `feedback.error.<key>`. Raw error text, URLs and status codes are never
 * shown; they go to the console through `reportFailure`.
 */
export type FailureKey =
  | 'network'
  | 'timeout'
  | 'server'
  | 'notFound'
  | 'rateLimited'
  | 'unauthorized'
  | 'validation'
  | 'unknown';

/** A request cancelled on purpose (AbortSignal): not a failure to show or log. */
export function isCancellation(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  return error instanceof DOMException && error.name === 'AbortError';
}

export function failureKey(error: unknown): FailureKey {
  if (!(error instanceof ApiError)) return 'unknown';
  if (error.kind === 'timeout') return 'timeout';
  if (error.kind === 'network') return 'network';
  if (error.kind === 'validation') return 'validation';
  if (error.kind === 'parse') return 'server';
  if (error.status === 404) return 'notFound';
  if (error.status === 401 || error.status === 403) return 'unauthorized';
  if (error.status === 429) return 'rateLimited';
  if (error.status >= 500) return 'server';
  return 'unknown';
}

/** Failures worth a retry button. A 404 or a rejected input will fail the same way again. */
export function isRetryable(error: unknown): boolean {
  const key = failureKey(error);
  return key !== 'notFound' && key !== 'validation' && key !== 'unauthorized';
}

const reported = new WeakSet<object>();

/**
 * `console.error` with enough detail to debug, once per failure object (so a
 * re-render, or a boundary plus a query cache, does not repeat it). The visitor
 * sees none of this.
 */
export function reportFailure(scope: string, error: unknown): void {
  if (isCancellation(error)) return;
  if (typeof error === 'object' && error !== null) {
    if (reported.has(error)) return;
    reported.add(error);
  }
  if (error instanceof ApiError) {
    console.error(`[thekra] ${scope} failed`, {
      kind: error.kind,
      status: error.status,
      code: error.code,
      endpoint: error.endpoint,
      requestId: error.requestId,
      message: error.message,
      // A browser reports a CORS block exactly like a dropped connection (status 0).
      hint:
        error.kind === 'network' && typeof window !== 'undefined'
          ? 'No response: offline, API down, or blocked by CORS (see the browser network log)'
          : undefined,
    });
    return;
  }
  console.error(`[thekra] ${scope} failed`, error);
}
