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
 * Privacy (owner round 8, Q1): the sin programs live in memory in this store, but on the device they are ALWAYS sealed:
 * AsyncStorage holds them only as `thekra.practice.sin.v1` (practice-core `sealForDevice`, AES-256-GCM under a key made
 * on this device and kept in the keystore, device-key.ts); the plain store text carries none. Programs an older version
 * wrote in clear are sealed once at the next start. Sign-out wipes everything (`wipeAll`), the key included. They
 * leave the device only sealed in the vault (vault-runner.ts); sync bodies are built by practice-core
 * `buildSyncRequest`, which has no programs. Never log the store.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VaultLockedError,
  emptyHeart,
  emptyStore,
  openFromDevice,
  parseHeart,
  parseStore,
  sealForDevice,
  serializeHeart,
  serializeStore,
  splitPrograms,
  todayFrom,
  updateSettings,
  type HeartData,
  type SinProgram,
  type Store,
} from '@thekra/practice-core';
import { forgetDeviceKey, getDeviceKey } from './device-key';
import { DEFAULT_PREFS, PREFS_KEY, legacyPrefs, parsePrefs, type PracticePrefs } from './prefs';

export const STORE_KEY = 'thekra.practice.v1';
/** The sin programs, sealed with the device key (`device-key.ts`). The plain store never carries them. */
export const SIN_KEY = 'thekra.practice.sin.v1';
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
  /**
   * Sign-out and account deletion: removes everything personal (habits, relatives, programs, reviews, messages, the sealed
   * copy and its key) and the link to the account. Device preferences stay, except the sin-related ones.
   */
  wipeAll: () => Promise<void>;
}

let writeChain: Promise<void> = Promise.resolve();
/** Programs written by an older version still sit in clear in the plain store, until they are sealed once. */
let plainPending = false;

function persist(key: string, value: string): Promise<void> {
  writeChain = writeChain.then(() => AsyncStorage.setItem(key, value)).catch(() => undefined);
  return writeChain;
}

/** The plain store text: never the programs (unless an old clear copy is still waiting to be sealed). */
function plainStoreText(store: Store): string {
  return serializeStore(plainPending ? store : splitPrograms(store).rest);
}

/** Seals the programs with the device key and stores them (removes the copy when there are none). Never throws. */
function persistPrograms(programs: readonly SinProgram[]): Promise<void> {
  writeChain = writeChain
    .then(async () => {
      if (programs.length === 0) {
        await AsyncStorage.removeItem(SIN_KEY);
        return;
      }
      const key = await getDeviceKey(true);
      if (!key) return;
      await AsyncStorage.setItem(SIN_KEY, sealForDevice(programs, key));
    })
    .catch(() => undefined); // not sealed: the programs stay in memory this session, never written in clear
  return writeChain;
}

/** The programs in the sealed copy: [] when there is none, the key is gone or the data is damaged (it is then dropped). */
async function readSealedPrograms(raw: string | null): Promise<{ programs: SinProgram[]; keep: boolean }> {
  if (!raw) return { programs: [], keep: false };
  try {
    const key = await getDeviceKey(false);
    if (!key) {
      await AsyncStorage.removeItem(SIN_KEY);
      return { programs: [], keep: false };
    }
    return { programs: openFromDevice(raw, key), keep: true };
  } catch (e) {
    if (e instanceof VaultLockedError || (e instanceof Error && e.name === 'VaultError')) await AsyncStorage.removeItem(SIN_KEY).catch(() => undefined);
    return { programs: [], keep: false };
  }
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
 * Where «لحظة مجاهدة» was opened from, in memory only (never persisted, never a route param): a sin page passes its slug
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
    let rawSin: string | null = null;
    try {
      const [rawStore, p, rawHeart, sealed] = await Promise.all([
        AsyncStorage.getItem(STORE_KEY),
        AsyncStorage.getItem(PREFS_KEY),
        AsyncStorage.getItem(HEART_KEY),
        AsyncStorage.getItem(SIN_KEY),
      ]);
      rawSin = sealed;
      rawPrefs = p;
      if (rawHeart) heart = parseHeart(rawHeart);
      if (rawStore) store = parseStore(rawStore);
      if (rawPrefs) prefs = parsePrefs(rawPrefs);
    } catch {
      // Unreadable storage: start empty rather than crash.
    }
    const migrated = migrateLegacy(store, rawPrefs, newPracticeId);
    let next = migrated.store;
    let rewrite = migrated.changed;
    if (next.programs.length > 0) {
      // An older version wrote the programs in clear: seal them now; the clear copy goes only once the sealed one is saved.
      try {
        const key = await getDeviceKey(true);
        if (key) {
          await AsyncStorage.setItem(SIN_KEY, sealForDevice(next.programs, key));
          rewrite = true;
        } else plainPending = true;
      } catch {
        plainPending = true; // not sealed: nothing is lost, the next start tries again
      }
    } else {
      const sealed = await readSealedPrograms(rawSin);
      if (sealed.programs.length > 0) next = { ...next, programs: sealed.programs };
    }
    set({ hydrated: true, store: next, prefs, heart });
    if (rewrite) {
      void persist(STORE_KEY, plainStoreText(next));
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
    const before = get().store.programs;
    set({ store: next });
    void persist(STORE_KEY, plainStoreText(next));
    if (!plainPending && JSON.stringify(before) !== JSON.stringify(next.programs)) void persistPrograms(next.programs);
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
    plainPending = false;
    set({ store: next, prefs });
    await persist(STORE_KEY, serializeStore(next));
    await persist(PREFS_KEY, JSON.stringify(prefs));
    await persistPrograms([]);
  },

  wipeAll: async () => {
    const prefs: PracticePrefs = { ...get().prefs, sinReminders: false, rememberVaultKey: false };
    pendingProgramSlug = null;
    momentSourceSlug = undefined;
    plainPending = false;
    set({ store: emptyStore(), heart: emptyHeart(), prefs });
    // A write that was already queued finishes first; then every key goes, and the device key last.
    await writeChain.catch(() => undefined);
    await Promise.all([STORE_KEY, HEART_KEY, SIN_KEY].map((k) => AsyncStorage.removeItem(k).catch(() => undefined)));
    await persist(PREFS_KEY, JSON.stringify(prefs));
    await forgetDeviceKey();
  },
}));
