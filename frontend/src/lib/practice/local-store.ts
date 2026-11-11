/**
 * The on-device practice store (plans, relatives, sin programs, settings) in localStorage.
 *
 * One practice-core `Store` (v2) under `thekra.practice.v1`; `parseStore` upgrades a v1 copy on first read. Every
 * read and write is wrapped: in a private window, with blocked site data or a full quota the store lives in memory
 * for the session and the page says it cannot be kept.
 *
 * The local copy is always the working copy. When the visitor is signed in, habits, kinship and settings also sync
 * with the account (`sync-engine.ts`). Sin programs never leave the device in clear: only the encrypted vault
 * (`vault-flow.ts`) does, and only when the visitor chooses it. On the device they are ALWAYS sealed (AES-GCM, a
 * non-extractable per-device key in IndexedDB, `device-key.ts`) under `SIN_KEY`; the plain store carries none. The
 * sealed copy is opened asynchronously on load: until then `usePracticeStore` returns null (the loading shell), so
 * a screen never shows «no program» for a program that is only waiting to be decrypted. Sign-out wipes everything
 * (`wipeLocalPractice`), key included.
 *
 * Web-only preferences that are not synced (and that the practice-core envelope does not carry: it drops unknown
 * fields on purpose) live beside it under `thekra.practice.prefs.v1`.
 */
import {
  DEFAULT_NOTIFICATION_PREFS,
  emptyStore,
  mergePrograms,
  parseNotificationPrefs,
  parseStore,
  programsFromText,
  programsToText,
  serializeStore,
  splitPrograms,
  updateSettings,
  type NotificationPrefs,
  type Plan,
  type SinProgram,
  type Store,
} from '@thekra/practice-core';
import { canSealOnDevice, forgetDeviceKey, openText, sealText } from './device-key';
import { isUuid, newUuid } from './ids';

export const STORE_KEY = 'thekra.practice.v1';
export const PREFS_KEY = 'thekra.practice.prefs.v1';
/**
 * The sin programs, sealed with this device's key (`device-key.ts`): `v1.<iv>.<ciphertext>`. The plain store under
 * `STORE_KEY` never carries them (owner round 8, Q1).
 */
export const SIN_KEY = 'thekra.practice.sin.v1';
/** A sin slug handed from a sin page to «تخفَّف» without putting it in the URL. Read once, then removed. */
export const PENDING_PROGRAM_KEY = 'thekra.practice.pending-program';

export interface PracticePrefs {
  /** Kinship calendar export shows nicknames instead of the generic title. Off by default. Not synced. */
  kinshipNamesInCalendar?: boolean;
  /** «إظهار التاريخ الهجري»: the Hijri date beside the Gregorian one on «ورد اليوم» and «سجلّي». Off by default. Not synced. */
  showHijri?: boolean;
  /** «شعبة الأسبوع» on «ورد اليوم»: shown only when the member chose to study the branches of faith (Settings). Not synced. */
  weekBranch?: boolean;
  /** The account this device's copy was last synced with; another account must confirm before merging. */
  syncedUserId?: string;
  /** «التنبيهات» on this browser (practice-core `NotificationPrefs`); absent = the defaults. Sent with the push subscription. */
  notify?: NotificationPrefs;
  /**
   * «ذكّرني باستراتيجية كل أسبوع»: absent = on. Off keeps the strategies chosen on «استراتيجيات العادات» and only leaves
   * them out of the reminders (as the app does). Not synced.
   */
  strategyReminders?: boolean;
}

/** This browser's notification switches, with the practice-core defaults for anything never set. */
export function notificationPrefsOf(prefs: PracticePrefs): NotificationPrefs {
  return prefs.notify ?? { ...DEFAULT_NOTIFICATION_PREFS };
}

/** What the reminders are planned with (the push payload): no strategy while «ذكّرني باستراتيجية» is off. */
export function plannedNotificationPrefs(prefs: PracticePrefs): NotificationPrefs {
  const notify = notificationPrefsOf(prefs);
  return prefs.strategyReminders === false ? { ...notify, strategies: [] } : notify;
}

export interface PracticeSnapshot {
  store: Store;
  prefs: PracticePrefs;
  /** False when the browser refused storage: changes last only until the tab closes. */
  persistent: boolean;
  /** The sealed programs have been opened (or there are none). Screens wait for it. */
  sinReady: boolean;
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
    if (record.showHijri === true) prefs.showHijri = true;
    if (record.weekBranch === true) prefs.weekBranch = true;
    if (record.strategyReminders === false) prefs.strategyReminders = false;
    if (typeof record.syncedUserId === 'string' && record.syncedUserId.length > 0) prefs.syncedUserId = record.syncedUserId;
    if (typeof record.notify === 'object' && record.notify !== null) prefs.notify = parseNotificationPrefs(record.notify);
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
/** «لحظة مجاهدة» hand-off, in memory only (never storage, never the URL): see {@link setMomentSource}. */
let momentSource: string | null | undefined;
const listeners = new Set<() => void>();
/** Bumped by every wipe: a seal or an open that started before it must not write or apply anything. */
let generation = 0;
let sinWriteChain: Promise<void> = Promise.resolve();
/** Programs written by an older version still sit in clear in the plain store, until they are sealed once. */
let plainPending = false;
/** The sealed copy exists but could not be opened this time (a browser hiccup): never overwrite it. */
let sinLocked = false;

function load(): PracticeSnapshot {
  const rawStore = readItem(STORE_KEY);
  const { prefs, legacyFreeMinutes } = parsePrefs(readItem(PREFS_KEY));
  const store = migrateStore(rawStore ? parseStore(rawStore) : emptyStore(), legacyFreeMinutes);
  const persistent = rawStore !== undefined && probeWritable();
  plainPending = store.programs.length > 0;
  sinLocked = false;
  if (persistent && rawStore) {
    // Save a migrated copy once, so the next read (and other tabs) see v2 with UUID plan ids. Old clear programs
    // stay where they are until `sealLegacyPrograms` has sealed them.
    const text = serializeStore(plainPending ? store : splitPrograms(store).rest);
    if (text !== rawStore) writeItem(STORE_KEY, text);
    if (legacyFreeMinutes !== undefined) writeItem(PREFS_KEY, JSON.stringify(prefs));
  }
  const sealed = readItem(SIN_KEY);
  const sinReady = plainPending || !sealed;
  const loaded: PracticeSnapshot = { store, prefs, persistent, sinReady };
  if (plainPending) void sealLegacyPrograms(generation, store.programs);
  else if (sealed) void openSealedPrograms(generation, sealed);
  return loaded;
}

/** Seals programs that an older version stored in clear, then removes them from the plain store. */
async function sealLegacyPrograms(gen: number, programs: readonly SinProgram[]): Promise<void> {
  try {
    const sealed = await sealText(programsToText(programs));
    if (gen !== generation || !snapshot) return;
    if (!writeItem(SIN_KEY, sealed)) return;
    plainPending = false;
    writeItem(STORE_KEY, serializeStore(splitPrograms(snapshot.store).rest));
  } catch {
    // Not sealed: the old copy stays as it was (nothing is lost) and the next load tries again.
  }
}

/** Opens the sealed programs and puts them into the snapshot; merges anything added while it was opening. */
async function openSealedPrograms(gen: number, sealed: string): Promise<void> {
  const opened = await openText(sealed);
  if (gen !== generation || !snapshot) return;
  let programs: SinProgram[] = [];
  if (opened.status === 'ok') programs = programsFromText(opened.text);
  else if (opened.status === 'error') sinLocked = true;
  else writeItem(SIN_KEY, null); // no key or damaged: unreadable for good
  const current = snapshot.store.programs;
  const merged = current.length > 0 ? mergePrograms(current, programs) : programs;
  snapshot = { ...snapshot, store: { ...snapshot.store, programs: merged }, sinReady: true };
  if (current.length > 0 && !sinLocked) queueSinWrite();
  emit();
}

/** Seals the current programs and stores them (or removes the copy when there are none), one write at a time. */
function queueSinWrite(): void {
  const gen = generation;
  sinWriteChain = sinWriteChain
    .then(async () => {
      if (gen !== generation || !snapshot || !snapshot.sinReady || sinLocked || plainPending) return;
      const programs = snapshot.store.programs;
      if (programs.length === 0) {
        writeItem(SIN_KEY, null);
        return;
      }
      if (!canSealOnDevice()) throw new Error('not available');
      const sealed = await sealText(programsToText(programs));
      if (gen !== generation) return;
      if (!writeItem(SIN_KEY, sealed)) throw new Error('storage refused');
    })
    .catch(() => {
      // The programs could not be sealed: they live in memory for this session and are never written in clear.
      if (snapshot) {
        snapshot = { ...snapshot, persistent: false };
        emit();
      }
    });
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

/** The snapshot for screens: null (the loading shell) until the sealed programs have been opened. */
export function getReadyPracticeSnapshot(): PracticeSnapshot | null {
  const current = getPracticeSnapshot();
  return current.sinReady ? current : null;
}

/** The server render has no device data: components show their loading shell until hydration. */
export function getServerPracticeSnapshot(): PracticeSnapshot | null {
  return null;
}

function onStorage(event: StorageEvent): void {
  if (event.key === null) {
    // Storage was cleared (another tab signed out, or the visitor cleared site data): start again from what is left.
    generation += 1;
    snapshot = load();
    emit();
    return;
  }
  if (event.key === STORE_KEY || event.key === PREFS_KEY) {
    if (!snapshot) return;
    const { prefs, legacyFreeMinutes } = parsePrefs(readItem(PREFS_KEY));
    const raw = readItem(STORE_KEY);
    const store = migrateStore(raw ? parseStore(raw) : emptyStore(), legacyFreeMinutes);
    // The programs are not in this key: keep the ones in memory, unless the other tab wiped everything.
    const programs = event.key === STORE_KEY && !raw ? [] : snapshot.store.programs;
    snapshot = { ...snapshot, store: { ...store, programs: plainPending ? store.programs : programs }, prefs };
    emit();
    return;
  }
  if (event.key === SIN_KEY && snapshot) {
    if (!event.newValue) {
      snapshot = { ...snapshot, store: { ...snapshot.store, programs: [] }, sinReady: true };
      emit();
    } else {
      void openSealedPrograms(generation, event.newValue);
    }
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
  const fullText = serializeStore(change(current.store));
  const next = parseStore(fullText);
  const saved = writeItem(STORE_KEY, plainPending ? fullText : serializeStore(splitPrograms(next).rest));
  const programsChanged = JSON.stringify(current.store.programs) !== JSON.stringify(next.programs);
  snapshot = { ...current, store: next, persistent: current.persistent && saved };
  if (programsChanged && !plainPending) queueSinWrite();
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
  generation += 1;
  plainPending = false;
  sinLocked = false;
  writeItem(PENDING_PROGRAM_KEY, null);
  writeItem(SIN_KEY, null);
  pendingForSession = null;
  momentSource = undefined;
  updateStore((store) => ({ ...store, programs: [] }));
}

/**
 * Sign-out (and another account signing in over this device's copy): everything personal in the practice store is
 * removed from this browser: habits, relatives, programs, settings, tombstones, sync bookkeeping, the sealed
 * programs AND the device key that sealed them. Device preferences stay (language of the reminders, Hijri date…),
 * but the link to the account does not. The heart data and the reminders are wiped by `local-wipe.ts`, which
 * calls this one.
 */
export async function wipeLocalPractice(): Promise<void> {
  generation += 1;
  plainPending = false;
  sinLocked = false;
  writeItem(PENDING_PROGRAM_KEY, null);
  writeItem(SIN_KEY, null);
  writeItem(STORE_KEY, null);
  pendingForSession = null;
  momentSource = undefined;
  const prefs = { ...(snapshot?.prefs ?? parsePrefs(readItem(PREFS_KEY)).prefs) };
  delete prefs.syncedUserId;
  const saved = writeItem(PREFS_KEY, JSON.stringify(prefs));
  snapshot = { store: emptyStore(), prefs, persistent: saved && (snapshot?.persistent ?? true), sinReady: true };
  emit();
  // A seal that was already running finishes first (it writes nothing: its generation is old), then the key goes.
  await sinWriteChain.catch(() => undefined);
  await forgetDeviceKey();
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

/**
 * Where «لحظة مجاهدة» was opened from, kept in memory for the client-side navigation only: a sin page passes its slug
 * (the screen then uses that sin's program if the visitor follows it, and nothing personal otherwise); «ورد اليوم» and
 * «تخفَّف» pass `null` (the program in focus, practice-core `focusProgram`). A reload forgets it.
 */
export function setMomentSource(slug: string | null): void {
  momentSource = slug;
}

/** `undefined` when nothing was handed over (a direct visit or a reload). */
export function momentSourceForView(): string | null | undefined {
  return momentSource;
}

/** Test hook: forget the cached snapshot so the next read goes back to storage. */
export function resetPracticeSnapshotForTests(): void {
  generation += 1;
  plainPending = false;
  sinLocked = false;
  sinWriteChain = Promise.resolve();
  snapshot = null;
  pendingForSession = undefined;
  momentSource = undefined;
}
