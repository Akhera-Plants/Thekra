/**
 * Account sync of the practice store: pure parts (payload, merge, decision). The network runner is
 * sync-runner.ts.
 *
 * What is sent: only practice-core `exportForSync(store)` (plans, relatives, settings). Sin programs are
 * never part of it (roadmap §0.1) and `buildSyncBody` re-checks that before anything leaves the device.
 *
 * Protocol (last-writer protection with a server version):
 *   1. GET /v1/me/practice → { store, version }.
 *   2. `decideSync` compares the local payload with what was last synced (`SyncMeta`):
 *      - nothing changed on either side → noop;
 *      - only the server changed → pull (replace plans/relatives/settings; programs stay);
 *      - only the device changed → push with the server version;
 *      - both changed, or first sync of this account on this device → merge, then push.
 *   3. PUT answers 409 PRACTICE_VERSION_CONFLICT when another device wrote in between: merge with the
 *      store the error carries (or a fresh GET) and push once more with that version.
 *
 * Merge rule (kept simple on purpose, no user prompt):
 *   - plans: union by id; for the same id the settings of the side whose amount changed last win
 *     (`amountChangedOn`, ties → this device), and the logs are merged day by day keeping the larger amount
 *     (a day is never counted twice);
 *   - relatives: union by id; name, relation and rhythm from this device, contact history = union;
 *   - settings: this device.
 *   Known limit: an item deleted on one device and edited on another while both were offline comes back
 *   after a conflict merge; deleting it again settles it.
 */

import {
  exportForSync,
  parseStore,
  type LocalDate,
  type Plan,
  type Relative,
  type Store,
  type SyncPayload,
} from '@thekra/practice-core';
import type { PracticeVersion } from './catalog-types';

export interface SyncMeta {
  /** Account the device last synced with. A different account means a first sync. */
  userId: string;
  version: PracticeVersion;
  /** JSON of the payload last pushed or pulled (`payloadJson`). */
  payloadJson: string;
}

/** Stable JSON of a sync payload (key order fixed by parseStore/exportForSync). */
export function payloadJson(payload: SyncPayload): string {
  return JSON.stringify(payload);
}

/** The PUT body. Throws if a `programs` key could ever be present. */
export function buildSyncBody(store: Store, version: PracticeVersion): { store: SyncPayload; version: PracticeVersion } {
  const payload = exportForSync(store);
  if (Object.prototype.hasOwnProperty.call(payload, 'programs')) {
    throw new Error('Sync payload must not contain sin programs');
  }
  return { store: payload, version };
}

function mergeLogs(a: Plan['log'], b: Plan['log']): Plan['log'] {
  const out: Plan['log'] = { ...a };
  for (const [d, v] of Object.entries(b)) out[d] = Math.max(out[d] ?? 0, v);
  return out;
}

function mergePlan(local: Plan, remote: Plan): Plan {
  const base = remote.amountChangedOn > local.amountChangedOn ? remote : local;
  return { ...base, log: mergeLogs(local.log, remote.log) };
}

function mergeRelative(local: Relative, remote: Relative): Relative {
  const history: LocalDate[] = [...local.history];
  for (const d of remote.history) if (!history.includes(d)) history.push(d);
  const merged: Relative = { ...local, history };
  let last: LocalDate | undefined;
  for (const d of history) if (last === undefined || d > last) last = d;
  if (last === undefined) delete merged.lastContactedOn;
  else merged.lastContactedOn = last;
  return merged;
}

function unionById<T extends { id: string }>(local: readonly T[], remote: readonly T[], merge: (l: T, r: T) => T): T[] {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const out = local.map((l) => {
    const r = remoteById.get(l.id);
    return r ? merge(l, r) : l;
  });
  const localIds = new Set(local.map((l) => l.id));
  for (const r of remote) if (!localIds.has(r.id)) out.push(r);
  return out;
}

/** Merges two sync payloads (see the rule above). The result is validated through parseStore. */
export function mergeSyncPayloads(local: SyncPayload, remote: SyncPayload): SyncPayload {
  const merged = {
    v: 1 as const,
    plans: unionById(local.plans, remote.plans, mergePlan),
    relatives: unionById(local.relatives, remote.relatives, mergeRelative),
    programs: [],
    settings: local.settings,
  };
  return exportForSync(parseStore(merged));
}

/** Replaces the synced parts of the local store; the sin programs on this device are kept untouched. */
export function applySyncPayload(store: Store, payload: SyncPayload | null): Store {
  const clean = parseStore({ v: 1, plans: payload?.plans ?? [], relatives: payload?.relatives ?? [], programs: [], settings: payload?.settings ?? store.settings });
  return { ...clean, programs: store.programs };
}

export type SyncDecision =
  | { action: 'noop' }
  | { action: 'pull'; payload: SyncPayload }
  | { action: 'push'; payload: SyncPayload }
  | { action: 'merge-push'; payload: SyncPayload };

export function decideSync(args: {
  local: SyncPayload;
  remote: { store: SyncPayload | null; version: PracticeVersion };
  meta: SyncMeta | null;
  userId: string;
}): SyncDecision {
  const { local, remote, userId } = args;
  const meta = args.meta && args.meta.userId === userId ? args.meta : null;
  const localJson = payloadJson(local);
  if (!meta) {
    if (!remote.store) return { action: 'push', payload: local };
    const merged = mergeSyncPayloads(local, remote.store);
    return payloadJson(merged) === payloadJson(remote.store) ? { action: 'pull', payload: remote.store } : { action: 'merge-push', payload: merged };
  }
  const localChanged = localJson !== meta.payloadJson;
  const remoteChanged = remote.version !== meta.version;
  if (!localChanged && !remoteChanged) return { action: 'noop' };
  // A server without a store (e.g. reset) never empties the device: push what the device has.
  if (!localChanged) return remote.store ? { action: 'pull', payload: remote.store } : { action: 'push', payload: local };
  if (!remoteChanged) return { action: 'push', payload: local };
  return { action: 'merge-push', payload: remote.store ? mergeSyncPayloads(local, remote.store) : local };
}

/** Reads `{ store, version }` from a 409 error's details, wherever the API put it. */
export function conflictFromDetails(details: unknown): { store: SyncPayload | null; version: PracticeVersion } | null {
  if (typeof details !== 'object' || details === null) return null;
  const d = details as Record<string, unknown>;
  const holder = (typeof d.current === 'object' && d.current !== null ? d.current : d) as Record<string, unknown>;
  if (typeof holder.version !== 'number') return null;
  const store = holder.store == null ? null : exportForSync(parseStore(holder.store));
  return { store, version: holder.version };
}
