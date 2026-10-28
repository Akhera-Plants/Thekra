/**
 * The on-device practice store (plans, relatives, sin programs, settings) in localStorage.
 *
 * One practice-core `Store` (v2) under `thekra.practice.v1`; `parseStore` upgrades a v1 copy on first read. Every
 * read and write is wrapped: in a private window, with blocked site data or a full quota the store lives in memory
 * for the session and the page says it cannot be kept.
 *
 * The local copy is always the working copy. When the visitor is signed in, habits, kinship and settings also sync
 * with the account (`sync-engine.ts`). Sin programs never leave the device in clear: only the encrypted vault
 * (`vault-flow.ts`) does, and only when the visitor chooses it.
 *
 * Web-only preferences that are not synced (and that the practice-core envelope does not carry: it drops unknown
 * fields on purpose) live beside it under `thekra.practice.prefs.v1`.
 */
import { emptyStore, parseStore, serializeStore, updateSettings, type Plan, type Store } from '@thekra/practice-core';
import { isUuid, newUuid } from './ids';

export const STORE_KEY = 'thekra.practice.v1';
export const PREFS_KEY = 'thekra.practice.prefs.v1';
/** A sin slug handed from a sin page to «ترك المعصية» without putting it in the URL. Read once, then removed. */
export const PENDING_PROGRAM_KEY = 'thekra.practice.pending-program';

export interface PracticePrefs {
  /** Kinship calendar export shows nicknames instead of the generic title. Off by default. Not synced. */
  kinshipNamesInCalendar?: boolean;
  /** The account this device's copy was last synced with; another account must confirm before merging. */
  syncedUserId?: string;
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

/** Reads the prefs key. `legacyFreeMinutes` is the v1-era free-minutes value, now a synced store setting. */
export function parsePrefs(raw: string | null | undefined): { prefs: PracticePrefs; legacyFreeMinutes?: number } {
  if (!raw) return { prefs: {} };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return { prefs: {} };
    const record = value as Record<string, unknown>;
    const prefs: PracticePrefs = {};
    if (record.kinshipNamesInCalendar === true) prefs.kinshipNamesInCalendar = true;
    if (typeof record.syncedUserId === 'string' && record.syncedUserId.length > 0) prefs.syncedUserId = record.syncedUserId;
    const minutes = record.freeMinutesPerDay;
    const legacyFreeMinutes =
      typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 0 && minutes <= MAX_FREE_MINUTES
        ? minutes
        : undefined;
    return legacyFreeMinutes === undefined ? { prefs } : { prefs, legacyFreeMinutes };
  } catch {
    return { prefs: {} };
  }
}

/**
 * Plans made before accounts used the catalog habit key as their id; the server needs a UUID. Such a plan was never
 * synced (sync did not exist), so it is re-keyed in place, without a tombstone, and keeps the key as `habitKey`.
 */
export function rekeyLegacyPlans(store: Store, makeId: () => string = newUuid): Store {
  if (store.plans.every((plan) => isUuid(plan.id))) return store;
  const plans = store.plans.map(
    (plan): Plan => (isUuid(plan.id) ? plan : { ...plan, habitKey: plan.habitKey ?? plan.id, id: makeId() }),
  );
  return { ...store, plans, tombstones: store.tombstones.filter((t) => t.kind !== 'plan' || isUuid(t.id)) };
}

/** Brings an older device copy to the current shape: v1 → v2 (practice-core), UUID plan ids, free minutes in settings. */
export function migrateStore(store: Store, legacyFreeMinutes: number | undefined): Store {
  let next = rekeyLegacyPlans(store);
  if (legacyFreeMinutes !== undefined && next.settings.freeMinutesPerDay === undefined) {
    next = updateSettings(next, { freeMinutesPerDay: legacyFreeMinutes });
  }
  return next;
}

let snapshot: PracticeSnapshot | null = null;
let pendingForSession: string | null | undefined;
const listeners = new Set<() => void>();

function load(): PracticeSnapshot {
  const rawStore = readItem(STORE_KEY);
  const { prefs, legacyFreeMinutes } = parsePrefs(readItem(PREFS_KEY));
  const store = migrateStore(rawStore ? parseStore(rawStore) : emptyStore(), legacyFreeMinutes);
  const persistent = rawStore !== undefined && probeWritable();
  if (persistent && rawStore) {
    // Save a migrated copy once, so the next read (and other tabs) see v2 with UUID plan ids.
    const text = serializeStore(store);
    if (text !== rawStore) writeItem(STORE_KEY, text);
    if (legacyFreeMinutes !== undefined) writeItem(PREFS_KEY, JSON.stringify(prefs));
  }
  return { store, prefs, persistent };
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

/**
 * Applies `change` to the store, keeps only what practice-core validates, saves, and notifies. Edit plans,
 * relatives and settings inside `change` with the practice-core store helpers (`upsertPlan`, `updatePlan`,
 * `deletePlan`, `upsertRelative`, `updateRelative`, `deleteRelative`, `undoContact`, `updateSettings`) so edit
 * times and tombstones stay right for sync.
 */
export function updateStore(change: (store: Store) => Store): void {
  const current = getPracticeSnapshot();
  const text = serializeStore(change(current.store));
  const saved = writeItem(STORE_KEY, text);
  snapshot = { ...current, store: parseStore(text), persistent: current.persistent && saved };
  emit();
}

export function updatePrefs(change: (prefs: PracticePrefs) => PracticePrefs): void {
  const current = getPracticeSnapshot();
  const next = parsePrefs(JSON.stringify(change(current.prefs))).prefs;
  const saved = writeItem(PREFS_KEY, JSON.stringify(next));
  snapshot = { ...current, prefs: next, persistent: current.persistent && saved };
  emit();
}

/** Forgets what the server is known to hold, so the next sync pulls everything and pushes every local item. */
export function resetSyncState(): void {
  updateStore((store) => ({ ...store, sync: { lastSyncedAt: null, acked: {} } }));
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
