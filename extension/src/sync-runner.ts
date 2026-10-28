/**
 * Account sync for the extension: plans and logs only (sync contract §5). Relatives, contacts and settings that
 * come back from the account are merged into the store and kept (so later syncs never delete them), but the
 * extension never sends them: it does not show or edit them. Sin programs are never sent by anyone; this module
 * additionally refuses to send any body that contains a `programs` key.
 *
 * One run: build the request with practice-core `buildSyncRequest`, keep only plans and logs, POST it, then merge
 * the answer with `applyServerChanges` into a freshly loaded store (edits made while the request was in flight
 * stay pending and go out next time). A first sync larger than the API's 500 items goes out in several rounds.
 */
import { applyServerChanges, buildSyncRequest, countChanges, type Store, type SyncChanges, type SyncRequest } from '@thekra/practice-core';
import { AuthError, type ApiResult, type AuthErrorCode } from './auth.js';

export const SYNC_PATH = '/v1/me/practice/sync';
/** Rounds per run (each sends at most 500 items). */
export const MAX_ROUNDS = 10;

export interface SyncStatus {
  state: 'ok' | 'error' | 'signedOut';
  /** ISO time of this result. */
  at: string;
  /** ISO time of the last successful sync. */
  lastOkAt?: string;
  error?: AuthErrorCode | 'invalid' | 'limit' | 'tooLarge';
}

export interface SyncDeps {
  request(path: string, init: { method: string; body: unknown }): Promise<ApiResult>;
  loadStore(): Promise<Store>;
  saveStore(store: Store): Promise<void>;
  now?: () => Date;
}

/** Only what the extension may send: plans and logs. Never settings, relatives, contacts or programs. */
export function extensionChanges(changes: SyncChanges): SyncChanges {
  return { plans: changes.plans, logs: changes.logs, relatives: [], contacts: [] };
}

/** The request body the extension sends for `store`. */
export function extensionRequest(store: Store): SyncRequest {
  const req = buildSyncRequest(store);
  return { since: req.since, changes: extensionChanges(req.changes) };
}

/** Items the extension still has to send. */
export function pendingCount(store: Store): number {
  return countChanges(extensionRequest(store).changes);
}

/** True when any object inside `value` has a `programs` key. */
export function containsPrograms(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (Array.isArray(v)) stack.push(...v);
    else if (typeof v === 'object' && v !== null) {
      if (Object.prototype.hasOwnProperty.call(v, 'programs')) return true;
      stack.push(...Object.values(v));
    }
  }
  return false;
}

function errorCode(res: ApiResult): SyncStatus['error'] {
  const body = res.body as { error?: { code?: unknown } } | null;
  const code = typeof body?.error?.code === 'string' ? body.error.code : '';
  if (res.status === 413 || code === 'PRACTICE_TOO_LARGE') return 'tooLarge';
  if (res.status === 422 || code === 'PRACTICE_LIMIT_REACHED') return 'limit';
  if (res.status === 400 || res.status === 404) return 'invalid';
  if (res.status === 429) return 'throttled';
  return 'server';
}

/** Runs one sync. Never throws: the outcome is the returned status. */
export async function runSync(deps: SyncDeps, previous?: SyncStatus): Promise<SyncStatus> {
  const now = () => (deps.now ?? (() => new Date()))().toISOString();
  const fail = (error: SyncStatus['error'], state: SyncStatus['state'] = 'error'): SyncStatus => {
    const out: SyncStatus = { state, at: now(), error };
    if (previous?.lastOkAt) out.lastOkAt = previous.lastOkAt;
    return out;
  };
  try {
    let lastPending = Number.POSITIVE_INFINITY;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const body = extensionRequest(await deps.loadStore());
      if (containsPrograms(body)) throw new Error('refusing to send a body with programs');
      const res = await deps.request(SYNC_PATH, { method: 'POST', body });
      if (!res.ok) return fail(errorCode(res));
      const merged = applyServerChanges(await deps.loadStore(), res.body);
      await deps.saveStore(merged);
      const pending = pendingCount(merged);
      // Done, or the server stopped acknowledging (avoid a loop): the rest goes out on the next run.
      if (pending === 0 || pending >= lastPending) break;
      lastPending = pending;
    }
    const at = now();
    return { state: 'ok', at, lastOkAt: at };
  } catch (err) {
    if (err instanceof AuthError) return fail(err.code, err.code === 'signedOut' || err.code === 'expired' ? 'signedOut' : 'error');
    // A malformed answer (applyServerChanges throws a TypeError) or the programs guard: nothing was applied.
    return fail('server');
  }
}

export function parseSyncStatus(raw: unknown): SyncStatus | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.state !== 'ok' && r.state !== 'error' && r.state !== 'signedOut') return null;
  if (typeof r.at !== 'string') return null;
  const out: SyncStatus = { state: r.state, at: r.at };
  if (typeof r.lastOkAt === 'string') out.lastOkAt = r.lastOkAt;
  if (typeof r.error === 'string') out.error = r.error as SyncStatus['error'];
  return out;
}
