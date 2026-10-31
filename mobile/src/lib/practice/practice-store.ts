/**
 * On-device practice state (Zustand). The practice-core Store v2 (plans, relatives, sin programs, settings,
 * tombstones, sync bookkeeping) is persisted as practice-core `serializeStore` JSON in AsyncStorage under
 * `thekra.practice.v1` (the key name is kept; `parseStore` upgrades a v1 envelope to v2). The app-only prefs
 * live under `thekra.practice.prefs.v1`.
 *
 * Every edit goes through practice-core's store helpers (`updatePlan`, `upsertPlan`, `deletePlan`,
 * `upsertRelative`, `updateRelative`, `deleteRelative`, `undoContact`, `updateSettings`) inside `setStore`, so
 * `updatedAt` and the tombstones that sync needs stay right.
 *
 * Privacy: the sin programs are in this store in clear, on this device only. They leave it only sealed in the
 * vault (vault-runner.ts); sync bodies are built by practice-core `buildSyncRequest`, which has no programs.
 * Never log the store.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyHeart,
  emptyStore,
  parseHeart,
  parseStore,
  serializeHeart,
  serializeStore,
  todayFrom,
  updateSettings,
  type HeartData,
  type Store,
} from '@thekra/practice-core';
import { DEFAULT_PREFS, PREFS_KEY, legacyPrefs, parsePrefs, type PracticePrefs } from './prefs';

export const STORE_KEY = 'thekra.practice.v1';
/** «المقامات» (practice-core `HeartData`): «نية اليوم», reviews, pledges. Device-local, never synced. */
export const HEART_KEY = 'thekra.practice.heart.v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One-time migration of data written by the first app version (before Store v2 / the sync contract):
 * plan ids were catalog habit keys and relative ids were not UUIDs, but the server uses the client id as a
 * global primary key. Such ids get a fresh UUID (the habit key moves to `habitKey`), the reminder rule kept in
 * prefs moves to `plan.rule`, and the free minutes move to the settings. These items were never synced (that
 * API did not exist), so no tombstone is written for the old ids.
 */
export function migrateLegacy(store: Store, rawPrefs: unknown, newId: () => string): { store: Store; changed: boolean } {
  const legacy = legacyPrefs(rawPrefs);
  let changed = false;
  const plans = store.plans.map((p) => {
    if (UUID_RE.test(p.id)) return p;
    changed = true;
    const rule = p.rule ?? legacy.planRules[p.id];
    return { ...p, id: newId(), habitKey: p.habitKey ?? p.id, ...(rule ? { rule } : {}) };
  });
  const relatives = store.relatives.map((r) => {
    if (UUID_RE.test(r.id)) return r;
    changed = true;
    return { ...r, id: newId() };
  });
  let next: Store = changed ? parseStore({ ...store, plans, relatives }) : store;
  if (legacy.freeMinutesPerDay !== null && next.settings.freeMinutesPerDay === undefined) {
    next = updateSettings(next, { freeMinutesPerDay: legacy.freeMinutesPerDay });
    changed = true;
  }
  return { store: next, changed };
}

interface PracticeState {
  hydrated: boolean;
  store: Store;
  prefs: PracticePrefs;
  heart: HeartData;
  hydrate: () => Promise<void>;
  /** Applies `fn` (practice-core heart helpers) and persists. Errors from invalid edits are swallowed. */
  setHeart: (fn: (h: HeartData) => HeartData) => void;
  /** Applies `fn` (practice-core store helpers) and persists. Errors from invalid edits are swallowed. */
  setStore: (fn: (s: Store) => Store) => void;
  setPrefs: (fn: (p: PracticePrefs) => PracticePrefs) => void;
  /** Removes every sin program, check-in and note from this device now (local part of the wipe). */
  wipePrograms: () => Promise<void>;
}

let writeChain: Promise<void> = Promise.resolve();

function persist(key: string, value: string): Promise<void> {
  writeChain = writeChain.then(() => AsyncStorage.setItem(key, value)).catch(() => undefined);
  return writeChain;
}

export function today(): string {
  return todayFrom(new Date());
}

let idFactory: () => string = () => {
  // Lazy so that Jest can import this module without the native expo-crypto module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newId } = require('../crypto/install') as typeof import('../crypto/install');
  return newId();
};

/** Id generator for new plans and relatives (UUID v4 from expo-crypto). Tests may replace it. */
export function newPracticeId(): string {
  return idFactory();
}

export function setIdFactory(fn: () => string): void {
  idFactory = fn;
}

/**
 * The sin chosen on a sin page («ابدأ برنامج الترك»), handed to the sin-program chooser. Memory only: never
 * persisted and never in a route param, so no URL, history entry or file names the sin (roadmap §0.2).
 */
let pendingProgramSlug: string | null = null;

export function setPendingProgram(slug: string | null): void {
  pendingProgramSlug = slug;
}

export function pendingProgram(): string | null {
  return pendingProgramSlug;
}

/**
 * Where «لحظة ضعف» was opened from, in memory only (never persisted, never a route param): a sin page passes its slug
 * (the screen then uses that sin's program only if the user follows it, and nothing personal otherwise); «ورد اليوم»
 * and «تخفَّف» pass `null` (the program in focus, practice-core `momentProgram`). `undefined` when nothing was handed.
 */
let momentSourceSlug: string | null | undefined;

export function setMomentSource(slug: string | null): void {
  momentSourceSlug = slug;
}

export function momentSource(): string | null | undefined {
  return momentSourceSlug;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  hydrated: false,
  store: emptyStore(),
  prefs: { ...DEFAULT_PREFS },
  heart: emptyHeart(),

  hydrate: async () => {
    if (get().hydrated) return;
    let store = emptyStore();
    let prefs = parsePrefs(null);
    let rawPrefs: string | null = null;
    let heart = emptyHeart();
    try {
      const [rawStore, p, rawHeart] = await Promise.all([
        AsyncStorage.getItem(STORE_KEY),
        AsyncStorage.getItem(PREFS_KEY),
        AsyncStorage.getItem(HEART_KEY),
      ]);
      rawPrefs = p;
      if (rawHeart) heart = parseHeart(rawHeart);
      if (rawStore) store = parseStore(rawStore);
      if (rawPrefs) prefs = parsePrefs(rawPrefs);
    } catch {
      // Unreadable storage: start empty rather than crash.
    }
    const migrated = migrateLegacy(store, rawPrefs, newPracticeId);
    set({ hydrated: true, store: migrated.store, prefs, heart });
    if (migrated.changed) {
      void persist(STORE_KEY, serializeStore(migrated.store));
      void persist(PREFS_KEY, JSON.stringify(prefs));
    }
  },

  setStore: (fn) => {
    let next: Store;
    try {
      next = parseStore(fn(get().store));
    } catch {
      return; // an invalid edit (the helpers throw RangeError) changes nothing
    }
    set({ store: next });
    void persist(STORE_KEY, serializeStore(next));
  },

  setHeart: (fn) => {
    let next: HeartData;
    try {
      next = parseHeart(serializeHeart(fn(get().heart)));
    } catch {
      return;
    }
    set({ heart: next });
    void persist(HEART_KEY, serializeHeart(next));
  },

  setPrefs: (fn) => {
    const next = parsePrefs(fn(get().prefs));
    set({ prefs: next });
    void persist(PREFS_KEY, JSON.stringify(next));
  },

  wipePrograms: async () => {
    const next: Store = { ...get().store, programs: [] };
    const prefs: PracticePrefs = { ...get().prefs, sinReminders: false, rememberVaultKey: false };
    pendingProgramSlug = null;
    momentSourceSlug = undefined;
    set({ store: next, prefs });
    await persist(STORE_KEY, serializeStore(next));
    await persist(PREFS_KEY, JSON.stringify(prefs));
  },
}));
