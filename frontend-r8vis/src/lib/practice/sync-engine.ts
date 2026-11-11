/**
 * The pure parts of practice sync (docs/plan/2026-10-practice-sync-contract.md §3): one sync run as a loop of
 * `POST /v1/me/practice/sync` rounds, and the timing policy. No React, no timers, no storage: the controller
 * (`sync-controller.ts`) supplies them, which keeps this testable.
 *
 * A run reads the latest local store for every round and merges each response into the latest store (not the one
 * the request was built from), so an edit made while a request is in flight is neither lost nor marked as synced:
 * practice-core acknowledges an item only when the server returns exactly the local version.
 */
import {
  applyServerChanges,
  buildSyncRequest,
  countChanges,
  localChanges,
  type Store,
  type SyncRequest,
  type SyncResponse,
} from '@thekra/practice-core';
import { ApiError } from '@/lib/types/api';

/** Debounce after a local edit. */
export const EDIT_DEBOUNCE_MS = 3_000;
/** Background sync while a practice page is open. */
export const PERIODIC_SYNC_MS = 15 * 60 * 1000;
/** A focus right after a sync does not start another one. */
export const FOCUS_MIN_GAP_MS = 10_000;
/** Rounds per run: 500 items each, so a very large first sync takes a few; more means something is refused. */
export const MAX_SYNC_ROUNDS = 10;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60 * 1000;

export interface SyncDeps {
  read: () => Store;
  write: (change: (store: Store) => Store) => void;
  post: (request: SyncRequest) => Promise<SyncResponse>;
  maxRounds?: number;
}

export interface SyncRunResult {
  rounds: number;
  /** Items still waiting after the run (0 when everything went out). */
  pending: number;
}

/** Items the server does not hold yet. */
export function pendingCount(store: Store): number {
  return countChanges(localChanges(store));
}

/**
 * One sync run: send the pending items (at most 500 per request, parents first, as practice-core orders them),
 * merge the answer, and repeat until nothing is pending. The first round always goes out, even with no local
 * changes, to pull what other devices wrote. Throws the request's error; what was merged before it stays merged.
 */
export async function syncUntilClean(deps: SyncDeps): Promise<SyncRunResult> {
  const max = deps.maxRounds ?? MAX_SYNC_ROUNDS;
  let pending = 0;
  for (let round = 1; round <= max; round++) {
    const request = buildSyncRequest(deps.read());
    const response = await deps.post(request);
    deps.write((current) => applyServerChanges(current, response));
    pending = pendingCount(deps.read());
    if (pending === 0) return { rounds: round, pending };
  }
  return { rounds: max, pending };
}

/** Wait before retry number `failures` (1, 2, …): 5 s doubling, at most 5 minutes. */
export function retryDelayMs(failures: number): number {
  const n = Math.max(1, Math.floor(failures));
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (n - 1));
}

/**
 * Whether trying again later can help. Network trouble, time-outs, 5xx and 429 can; a request the server refused
 * (400 invalid item, 413, 422 limit) will be refused again until the data changes, so it waits for the next edit
 * or a manual «زامِن الآن».
 */
export function isTransientSyncError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.kind === 'network' || error.kind === 'timeout') return true;
  return error.status === 429 || error.status >= 500;
}

/** True when the signed-in account differs from the one this device's copy was synced with. */
export function isOtherAccount(syncedUserId: string | undefined, userId: string): boolean {
  return syncedUserId !== undefined && syncedUserId !== userId;
}
