/**
 * Account sync of habits, kinship and settings (docs/plan/2026-10-practice-sync-contract.md §3–§5).
 *
 * - Pending local edits → `POST /v1/me/practice/sync` with practice-core `buildSyncRequest` (since = the last
 *   `serverTime`, at most 500 items), merged back with `applyServerChanges`; repeated until nothing is pending
 *   (a large first sync goes out in batches). Nothing pending → `GET /v1/me/practice?since=` to pull.
 * - Merge rules, versions and tombstones are practice-core's; this file only moves bodies.
 * - The sync body never contains the sin program: practice-core builds it from plans, relatives and settings
 *   only, and `assertNoPrograms` re-checks every body before it leaves.
 * - Another account on this device: the sync bookkeeping (`store.sync`) is reset so everything is pushed again.
 * - Single-flight; never throws; offline is a normal state. Status for Settings in `useSyncStatus`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { applyServerChanges, buildSyncRequest, countChanges, localChanges, type SyncResponse } from '@thekra/practice-core';
import { getPracticeChanges, postPracticeSync } from '../api/practice';
import { ApiError } from '../types/api';
import { usePracticeStore } from './practice-store';

export const SYNC_META_KEY = 'thekra.practice.sync.v1';
/** Upper bound of POST rounds in one run (500 items each). */
const MAX_ROUNDS = 20;

export type SyncResult = 'ok' | 'offline' | 'error';
export type SyncStatus = 'idle' | 'running' | SyncResult;

export const useSyncStatus = create<{ status: SyncStatus; lastOkAt: string | null }>(() => ({
  status: 'idle',
  lastOkAt: null,
}));

/** Throws if any key named `programs` appears anywhere in a body about to be sent. */
export function assertNoPrograms(body: unknown): void {
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) {
        if (k === 'programs') throw new Error('A sync body must never contain programs');
        walk(child);
      }
    }
  };
  walk(body);
}

async function loadAccount(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_META_KEY);
    const m = raw ? (JSON.parse(raw) as { userId?: unknown }) : null;
    return typeof m?.userId === 'string' ? m.userId : null;
  } catch {
    return null;
  }
}

/** Forgets which account this device synced with (sign-out, account deletion). Local data is kept. */
export async function clearSyncMeta(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SYNC_META_KEY);
  } catch {
    // ignore
  }
}

async function ensureAccount(userId: string): Promise<void> {
  if ((await loadAccount()) === userId) return;
  // New account for this device: the server holds none of our items yet.
  usePracticeStore.getState().setStore((s) => ({ ...s, sync: { lastSyncedAt: null, acked: {} } }));
  await AsyncStorage.setItem(SYNC_META_KEY, JSON.stringify({ userId }));
}

function apply(response: SyncResponse): void {
  const { store } = usePracticeStore.getState();
  const next = applyServerChanges(store, response); // throws on a response without serverTime
  usePracticeStore.getState().setStore(() => next);
}

/** Items waiting to be sent. */
export function pendingCount(): number {
  return countChanges(localChanges(usePracticeStore.getState().store));
}

async function run(userId: string): Promise<SyncResult> {
  const state = usePracticeStore.getState();
  if (!state.hydrated) await state.hydrate();
  try {
    await ensureAccount(userId);
    let pending = pendingCount();
    if (pending === 0) {
      apply(await getPracticeChanges(usePracticeStore.getState().store.sync.lastSyncedAt));
      return 'ok';
    }
    for (let round = 0; round < MAX_ROUNDS && pending > 0; round++) {
      const body = buildSyncRequest(usePracticeStore.getState().store);
      assertNoPrograms(body);
      apply(await postPracticeSync(body));
      const next = pendingCount();
      if (next >= pending) break; // no progress (e.g. items the server would not take): try again next run
      pending = next;
    }
    return 'ok';
  } catch (e) {
    if (e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR')) return 'offline';
    return 'error';
  }
}

let inFlight: Promise<SyncResult> | null = null;

export function syncPractice(userId: string): Promise<SyncResult> {
  if (!inFlight) {
    useSyncStatus.setState({ status: 'running' });
    inFlight = run(userId)
      .then((result) => {
        useSyncStatus.setState((s) => ({ status: result, lastOkAt: result === 'ok' ? new Date().toISOString() : s.lastOkAt }));
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
