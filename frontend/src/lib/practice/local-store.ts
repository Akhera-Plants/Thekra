/**
 * The on-device practice store (plans, relatives, sin programs, settings) in localStorage.
 *
 * One practice-core `Store` under `thekra.practice.v1`. Every read and write is wrapped: in a private
 * window, with blocked site data or a full quota the store lives in memory for the session and the page
 * says it cannot be kept. Nothing here is ever sent to a server (sin programs: roadmap §0.1).
 *
 * Web-only preferences that the practice-core envelope does not carry (it drops unknown fields on
 * purpose) live beside it under `thekra.practice.prefs.v1`.
 */
import { emptyStore, parseStore, serializeStore, type Store } from '@thekra/practice-core';

export const STORE_KEY = 'thekra.practice.v1';
export const PREFS_KEY = 'thekra.practice.prefs.v1';
/** A sin slug handed from a sin page to «ترك المعصية» without putting it in the URL. Read once, then removed. */
export const PENDING_PROGRAM_KEY = 'thekra.practice.pending-program';

export interface PracticePrefs {
  /** «فروضي وأدواري»: free minutes a day after obligations and roles. */
  freeMinutesPerDay?: number;
  /** Kinship calendar export shows nicknames instead of the generic title. Off by default. */
  kinshipNamesInCalendar?: boolean;
}

export interface PracticeSnapshot {
  store: Store;
  prefs: PracticePrefs;
  /** False when the browser refused storage: changes last only until the tab closes. */
  persistent: boolean;
}

const MAX_FREE_MINUTES = 24 * 60;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readItem(key: string): string | null | undefined {
  const s = storage();
  if (!s) return undefined;
  try {
    return s.getItem(key);
  } catch {
    return undefined;
  }
}

function writeItem(key: string, value: string | null): boolean {
  const s = storage();
  if (!s) return false;
  try {
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function parsePrefs(raw: string | null | undefined): PracticePrefs {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return {};
    const record = value as Record<string, unknown>;
    const prefs: PracticePrefs = {};
    const minutes = record.freeMinutesPerDay;
    if (typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 0 && minutes <= MAX_FREE_MINUTES) {
      prefs.freeMinutesPerDay = minutes;
    }
    if (record.kinshipNamesInCalendar === true) prefs.kinshipNamesInCalendar = true;
    return prefs;
  } catch {
    return {};
  }
}

let snapshot: PracticeSnapshot | null = null;
let pendingForSession: string | null | undefined;
const listeners = new Set<() => void>();

function load(): PracticeSnapshot {
  const rawStore = readItem(STORE_KEY);
  const rawPrefs = readItem(PREFS_KEY);
  return {
    store: rawStore ? parseStore(rawStore) : emptyStore(),
    prefs: parsePrefs(rawPrefs),
    persistent: rawStore !== undefined && probeWritable(),
  };
}

function probeWritable(): boolean {
  const probe = `${STORE_KEY}.probe`;
  if (!writeItem(probe, '1')) return false;
  writeItem(probe, null);
  return true;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getPracticeSnapshot(): PracticeSnapshot {
  if (!snapshot) snapshot = load();
  return snapshot;
}

/** The server render has no device data: components show their loading shell until hydration. */
export function getServerPracticeSnapshot(): PracticeSnapshot | null {
  return null;
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === STORE_KEY || event.key === PREFS_KEY) {
    snapshot = load();
    emit();
  }
}

export function subscribePractice(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Applies `change` to the store, keeps only what practice-core validates, saves, and notifies. */
export function updateStore(change: (store: Store) => Store): void {
  const current = getPracticeSnapshot();
  const text = serializeStore(change(current.store));
  const saved = writeItem(STORE_KEY, text);
  snapshot = { ...current, store: parseStore(text), persistent: current.persistent && saved };
  emit();
}

export function updatePrefs(change: (prefs: PracticePrefs) => PracticePrefs): void {
  const current = getPracticeSnapshot();
  const next = parsePrefs(JSON.stringify(change(current.prefs)));
  const saved = writeItem(PREFS_KEY, JSON.stringify(next));
  snapshot = { ...current, prefs: next, persistent: current.persistent && saved };
  emit();
}

/** «احذف كل بيانات البرنامج»: every sin program and the pending hand-off, removed from the device at once. */
export function wipeSinPrograms(): void {
  writeItem(PENDING_PROGRAM_KEY, null);
  pendingForSession = null;
  updateStore((store) => ({ ...store, programs: [] }));
}

export function setPendingProgram(slug: string): void {
  writeItem(PENDING_PROGRAM_KEY, slug);
  // A new hand-off within the same app session must be read again.
  pendingForSession = undefined;
}

/** Reads and removes the pending program slug (a one-time hand-off). */
export function takePendingProgram(): string | null {
  const value = readItem(PENDING_PROGRAM_KEY);
  if (value) writeItem(PENDING_PROGRAM_KEY, null);
  return value ?? null;
}

/**
 * The pending slug for this page view: taken from storage on the first call, then kept in memory so a
 * re-render (or React's double render in development) reads the same value. Usable as a
 * `useSyncExternalStore` snapshot.
 */
export function pendingProgramForSession(): string | null {
  if (pendingForSession === undefined) pendingForSession = takePendingProgram();
  return pendingForSession;
}

/** Test hook: forget the cached snapshot so the next read goes back to storage. */
export function resetPracticeSnapshotForTests(): void {
  snapshot = null;
  pendingForSession = undefined;
}
