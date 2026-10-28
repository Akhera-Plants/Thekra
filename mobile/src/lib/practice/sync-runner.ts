/**
 * Runs the account sync described in sync.ts against GET/PUT /v1/me/practice. Single-flight; never throws.
 * Only `exportForSync` data is sent (built by `buildSyncBody`); sin programs stay on the device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportForSync, type SyncPayload } from '@thekra/practice-core';
import { getRemotePractice, putRemotePractice } from '../api/practice';
import { ApiError } from '../types/api';
import type { PracticeVersion } from './catalog-types';
import { usePracticeStore } from './practice-store';
import {
  applySyncPayload,
  buildSyncBody,
  conflictFromDetails,
  decideSync,
  mergeSyncPayloads,
  payloadJson,
  type SyncMeta,
} from './sync';

export const SYNC_META_KEY = 'thekra.practice.sync.v1';

export type SyncResult = 'ok' | 'offline' | 'conflict' | 'error';

async function loadMeta(): Promise<SyncMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<SyncMeta>;
    if (typeof m.userId !== 'string' || typeof m.version !== 'number' || typeof m.payloadJson !== 'string') return null;
    return m as SyncMeta;
  } catch {
    return null;
  }
}

async function saveMeta(meta: SyncMeta): Promise<void> {
  await AsyncStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

/** Forgets the account link (sign-out, account deletion). Local practice data is kept. */
export async function clearSyncMeta(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SYNC_META_KEY);
  } catch {
    // ignore
  }
}

function adopt(payload: SyncPayload): void {
  usePracticeStore.getState().setStore((s) => applySyncPayload(s, payload));
}

async function push(userId: string, payload: SyncPayload, version: PracticeVersion): Promise<SyncResult> {
  // The local store becomes the payload first, so the device shows what it sends.
  adopt(payload);
  const body = buildSyncBody(usePracticeStore.getState().store, version);
  try {
    const res = await putRemotePractice(body);
    await saveMeta({ userId, version: res.version, payloadJson: payloadJson(body.store) });
    return 'ok';
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 409) throw e;
    // Another device wrote in between: merge with the server's current store and try once more.
    const current = conflictFromDetails(e.rawDetails) ?? (await getRemotePractice());
    const merged = current.store ? mergeSyncPayloads(body.store, current.store) : body.store;
    adopt(merged);
    const retryBody = buildSyncBody(usePracticeStore.getState().store, current.version);
    try {
      const res = await putRemotePractice(retryBody);
      await saveMeta({ userId, version: res.version, payloadJson: payloadJson(retryBody.store) });
      return 'ok';
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 409) return 'conflict'; // next run tries again
      throw e2;
    }
  }
}

async function run(userId: string): Promise<SyncResult> {
  const state = usePracticeStore.getState();
  if (!state.hydrated) await state.hydrate();
  try {
    const [remote, meta] = await Promise.all([getRemotePractice(), loadMeta()]);
    const local = exportForSync(usePracticeStore.getState().store);
    const decision = decideSync({ local, remote, meta, userId });
    switch (decision.action) {
      case 'noop':
        return 'ok';
      case 'pull':
        adopt(decision.payload);
        await saveMeta({
          userId,
          version: remote.version,
          payloadJson: payloadJson(exportForSync(usePracticeStore.getState().store)),
        });
        return 'ok';
      case 'push':
      case 'merge-push':
        return await push(userId, decision.payload, remote.version);
    }
  } catch (e) {
    if (e instanceof ApiError && (e.status === 0 || e.code === 'NETWORK_ERROR')) return 'offline';
    return 'error';
  }
}

let inFlight: Promise<SyncResult> | null = null;

export function syncPractice(userId: string): Promise<SyncResult> {
  if (!inFlight) {
    inFlight = run(userId).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
