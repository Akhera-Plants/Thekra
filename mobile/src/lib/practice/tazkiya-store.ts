/**
 * «دفتر المحاسبة»: the morning intentions, the evening reckonings and the set-aside cards (practice-core
 * `TazkiyaJournal`), on this device only under its own AsyncStorage key `thekra.tazkiya.v1`. Like the sin program
 * it is never in the practice Store, so it is never synced, never in the account export and never in a notification
 * (roadmap §0.1). Every edit goes through practice-core's journal helpers inside `update`. Never log the journal.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyJournal, parseJournal, serializeJournal, type TazkiyaJournal } from '@thekra/practice-core';

export const TAZKIYA_KEY = 'thekra.tazkiya.v1';

interface TazkiyaState {
  hydrated: boolean;
  journal: TazkiyaJournal;
  hydrate: () => Promise<void>;
  /** Applies `fn` (practice-core journal helpers) and persists. An invalid edit (RangeError) leaves the journal as it was. */
  update: (fn: (j: TazkiyaJournal) => TazkiyaJournal) => void;
  /** Deletes the whole notebook from this device. */
  clear: () => Promise<void>;
}

let writeChain: Promise<void> = Promise.resolve();

function persist(value: string): Promise<void> {
  writeChain = writeChain.then(() => AsyncStorage.setItem(TAZKIYA_KEY, value)).catch(() => undefined);
  return writeChain;
}

export const useTazkiyaStore = create<TazkiyaState>((set, get) => ({
  hydrated: false,
  journal: emptyJournal(),

  hydrate: async () => {
    if (get().hydrated) return;
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(TAZKIYA_KEY);
    } catch {
      raw = null;
    }
    set({ hydrated: true, journal: parseJournal(raw) });
  },

  update: (fn) => {
    let next: TazkiyaJournal;
    try {
      next = fn(get().journal);
    } catch {
      return;
    }
    set({ journal: next });
    void persist(serializeJournal(next));
  },

  clear: async () => {
    set({ journal: emptyJournal() });
    writeChain = writeChain.then(() => AsyncStorage.removeItem(TAZKIYA_KEY)).catch(() => undefined);
    await writeChain;
  },
}));
