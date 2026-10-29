/**
 * «دفتر المحاسبة» on the website: the morning intentions, the evening reckonings and the set-aside cards
 * (practice-core `TazkiyaJournal`) in localStorage under `thekra.tazkiya.v1`, the same shape as the app.
 *
 * Private and local only, like the sin program (roadmap §0.1): it is not part of the practice store, so it is never
 * synced, never in the account export, never in a notification. Every read and write is wrapped: when the browser
 * refuses storage the journal lives in memory for the session.
 */
import { emptyJournal, parseJournal, serializeJournal, type TazkiyaJournal } from '@thekra/practice-core';

export const TAZKIYA_KEY = 'thekra.tazkiya.v1';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(): TazkiyaJournal {
  try {
    return parseJournal(storage()?.getItem(TAZKIYA_KEY) ?? null);
  } catch {
    return emptyJournal();
  }
}

function write(journal: TazkiyaJournal | null): void {
  try {
    const s = storage();
    if (!s) return;
    if (journal === null) s.removeItem(TAZKIYA_KEY);
    else s.setItem(TAZKIYA_KEY, serializeJournal(journal));
  } catch {
    // Storage refused: the journal stays in memory for this session.
  }
}

let journal: TazkiyaJournal | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getJournalSnapshot(): TazkiyaJournal {
  journal ??= read();
  return journal;
}

/** The server render has no device data. */
export function getServerJournalSnapshot(): TazkiyaJournal | null {
  return null;
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === TAZKIYA_KEY) {
    journal = read();
    emit();
  }
}

export function subscribeJournal(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Applies `change` (practice-core journal helpers) and saves. An invalid edit (RangeError) leaves the journal as it was. */
export function updateJournal(change: (j: TazkiyaJournal) => TazkiyaJournal): void {
  let next: TazkiyaJournal;
  try {
    next = change(getJournalSnapshot());
  } catch {
    return;
  }
  journal = next;
  write(next);
  emit();
}

/** «احذف الدفتر كله»: removes the whole notebook from this browser. */
export function clearJournal(): void {
  journal = emptyJournal();
  write(null);
  emit();
}
