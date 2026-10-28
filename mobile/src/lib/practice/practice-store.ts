/**
 * On-device practice state (Zustand). The practice-core Store (plans, relatives, sin programs, settings)
 * is persisted as practice-core `serializeStore` JSON in AsyncStorage under `thekra.practice.v1`; the
 * app-only prefs live under `thekra.practice.prefs.v1`.
 *
 * Privacy: the sin programs are in this store because practice-core keeps one envelope, but they never
 * leave the device. Only sync.ts reads the store for the network, and it sends `exportForSync` (no programs).
 * Never log the store.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyStore,
  normalize,
  parseStore,
  serializeStore,
  todayFrom,
  type Store,
} from '@thekra/practice-core';
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, type PracticePrefs } from './prefs';

export const STORE_KEY = 'thekra.practice.v1';

interface PracticeState {
  hydrated: boolean;
  store: Store;
  prefs: PracticePrefs;
  hydrate: () => Promise<void>;
  /** Applies `fn` and persists. `fn` must return a new store (practice-core functions are pure). */
  setStore: (fn: (s: Store) => Store) => void;
  setPrefs: (fn: (p: PracticePrefs) => PracticePrefs) => void;
  /** Ends seasons whose date has passed (practice-core `normalize`). */
  normalizeToday: () => void;
  /** «احذف كل بيانات البرنامج»: removes every sin program, check-in and note from the device now. */
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

export const usePracticeStore = create<PracticeState>((set, get) => ({
  hydrated: false,
  store: emptyStore(),
  prefs: { ...DEFAULT_PREFS, planRules: {} },

  hydrate: async () => {
    if (get().hydrated) return;
    let store = emptyStore();
    let prefs = parsePrefs(null);
    try {
      const [rawStore, rawPrefs] = await Promise.all([AsyncStorage.getItem(STORE_KEY), AsyncStorage.getItem(PREFS_KEY)]);
      if (rawStore) store = parseStore(rawStore);
      if (rawPrefs) prefs = parsePrefs(rawPrefs);
    } catch {
      // Unreadable storage: start empty rather than crash.
    }
    const d = today();
    store = { ...store, plans: store.plans.map((p) => normalize(p, d)) };
    set({ hydrated: true, store, prefs });
  },

  setStore: (fn) => {
    const next = parseStore(fn(get().store));
    set({ store: next });
    void persist(STORE_KEY, serializeStore(next));
  },

  setPrefs: (fn) => {
    const next = parsePrefs(fn(get().prefs));
    set({ prefs: next });
    void persist(PREFS_KEY, JSON.stringify(next));
  },

  normalizeToday: () => {
    const d = today();
    const { store } = get();
    const plans = store.plans.map((p) => normalize(p, d));
    if (plans.some((p, i) => p !== store.plans[i] && JSON.stringify(p) !== JSON.stringify(store.plans[i]))) {
      get().setStore((s) => ({ ...s, plans }));
    }
  },

  wipePrograms: async () => {
    const next: Store = { ...get().store, programs: [] };
    const prefs: PracticePrefs = { ...get().prefs, sinReminders: false };
    set({ store: next, prefs });
    await persist(STORE_KEY, serializeStore(next));
    await persist(PREFS_KEY, JSON.stringify(prefs));
  },
}));
