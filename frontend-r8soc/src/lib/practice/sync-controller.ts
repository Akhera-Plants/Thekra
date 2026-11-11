/**
 * The practice sync controller: one per tab. It runs `syncUntilClean` on sign-in, on window focus, 3 s after a
 * local edit, every 15 minutes while a practice page is open, and when the browser comes back online; it retries
 * transient failures with back-off and never blocks the page (everything is async; the local copy stays the
 * working copy). Status is a small external store for `useSyncExternalStore`.
 */
import { postPracticeSync } from '@/lib/api/practice-me';
import { reportFailure } from '@/lib/errors';
import { getPracticeSnapshot, subscribePractice, updatePrefs, updateStore } from './local-store';
import {
  EDIT_DEBOUNCE_MS,
  FOCUS_MIN_GAP_MS,
  PERIODIC_SYNC_MS,
  isTransientSyncError,
  pendingCount,
  retryDelayMs,
  syncUntilClean,
} from './sync-engine';

export type SyncPhase = 'off' | 'syncing' | 'synced' | 'pending' | 'error' | 'offline' | 'otherAccount';

export interface SyncStatus {
  phase: SyncPhase;
  /** The server time of the last successful sync (ISO), from the store. */
  lastSyncedAt: string | null;
  /** The last failure (an ApiError in practice); shown only through the localized failure keys. */
  error: unknown;
  /** A retry is scheduled (transient failure). */
  willRetry: boolean;
}

const OFF: SyncStatus = { phase: 'off', lastSyncedAt: null, error: null, willRetry: false };

let status: SyncStatus = OFF;
const listeners = new Set<() => void>();
let userId: string | null = null;
let running = false;
let rerun = false;
let failures = 0;
let lastFinishedAt = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let periodicTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeStore: (() => void) | null = null;

function setStatus(next: Partial<SyncStatus>): void {
  status = { ...status, ...next };
  for (const listener of listeners) listener();
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function getServerSyncStatus(): SyncStatus {
  return OFF;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clearTimers(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (retryTimer) clearTimeout(retryTimer);
  if (periodicTimer) clearInterval(periodicTimer);
  debounceTimer = retryTimer = periodicTimer = null;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function run(): Promise<void> {
  if (!userId) return;
  if (running) {
    rerun = true;
    return;
  }
  if (isOffline()) {
    setStatus({ phase: 'offline', willRetry: true });
    return;
  }
  const account = userId;
  running = true;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  setStatus({ phase: 'syncing' });
  try {
    const result = await syncUntilClean({
      read: () => getPracticeSnapshot().store,
      write: updateStore,
      post: postPracticeSync,
    });
    if (userId !== account) return;
    failures = 0;
    if (getPracticeSnapshot().prefs.syncedUserId !== account) updatePrefs((prefs) => ({ ...prefs, syncedUserId: account }));
    setStatus({
      phase: result.pending === 0 ? 'synced' : 'pending',
      lastSyncedAt: getPracticeSnapshot().store.sync.lastSyncedAt,
      error: null,
      willRetry: false,
    });
  } catch (error) {
    if (userId !== account) return;
    reportFailure('practice sync', error);
    failures += 1;
    const transient = isTransientSyncError(error);
    setStatus({ phase: isOffline() ? 'offline' : 'error', error, willRetry: transient });
    if (transient) retryTimer = setTimeout(() => void run(), retryDelayMs(failures));
  } finally {
    running = false;
    lastFinishedAt = Date.now();
    if (rerun && userId) {
      rerun = false;
      void run();
    }
  }
}

function onStoreChange(): void {
  if (!userId || status.phase === 'otherAccount') return;
  // Only real local edits: after a sync is merged nothing is pending, so a merge never triggers another run.
  if (pendingCount(getPracticeSnapshot().store) === 0) return;
  if (running) {
    rerun = true;
    return;
  }
  setStatus({ phase: status.phase === 'error' || status.phase === 'offline' ? status.phase : 'pending' });
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void run(), EDIT_DEBOUNCE_MS);
}

function onFocus(): void {
  if (Date.now() - lastFinishedAt >= FOCUS_MIN_GAP_MS) void run();
}

function onOnline(): void {
  void run();
}

function attach(): void {
  unsubscribeStore = subscribePractice(onStoreChange);
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  periodicTimer = setInterval(() => void run(), PERIODIC_SYNC_MS);
}

function detach(): void {
  clearTimers();
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (typeof window !== 'undefined') {
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
  }
}

/**
 * Turns sync on for `account` (the signed-in user's id) or off (`null`). A device copy last synced with another
 * account is not merged automatically: the status becomes 'otherAccount' until {@link mergeIntoAccount}.
 */
export function setSyncAccount(account: string | null): void {
  if (account === userId) return;
  detach();
  userId = account;
  failures = 0;
  rerun = false;
  if (!account) {
    setStatus(OFF);
    return;
  }
  const { prefs, store } = getPracticeSnapshot();
  if (prefs.syncedUserId !== undefined && prefs.syncedUserId !== account) {
    setStatus({ ...OFF, phase: 'otherAccount' });
    return;
  }
  setStatus({ phase: 'syncing', lastSyncedAt: store.sync.lastSyncedAt, error: null, willRetry: false });
  attach();
  void run();
}

/** «زامِن الآن»: an immediate run (also after a refused request). */
export function syncNow(): void {
  void run();
}

/**
 * The visitor chose to add this device's copy to the signed-in account: forget the previous account's sync
 * bookkeeping, so everything is pushed and the account's data is pulled and merged.
 */
export function mergeIntoAccount(): void {
  const account = userId;
  if (!account) return;
  updateStore((store) => ({ ...store, sync: { lastSyncedAt: null, acked: {} } }));
  updatePrefs((prefs) => ({ ...prefs, syncedUserId: account }));
  setStatus({ phase: 'syncing', error: null });
  attach();
  void run();
}

/** After the account is deleted: the local copy stays, linked to no account. */
export function forgetAccount(): void {
  setSyncAccount(null);
  updateStore((store) => ({ ...store, sync: { lastSyncedAt: null, acked: {} } }));
  updatePrefs((prefs) => {
    const next = { ...prefs };
    delete next.syncedUserId;
    return next;
  });
}
