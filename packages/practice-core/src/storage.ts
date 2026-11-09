/**
 * The on-device store: one versioned JSON envelope for plans, relatives, sin programs and settings (v2).
 *
 * `parseStore` is defensive: it never throws, drops entries that fail validation, copies only known fields (so a
 * stray field can never ride along into an export), and upgrades a v1 store losslessly. `exportForSync` and the
 * sync body (`sync.ts`) never contain `programs`: sin-program data leaves the device only inside the encrypted
 * vault (`vault.ts`), never in clear (docs/plan/2026-10-practice-sync-contract.md §1).
 *
 * v2 adds what sync needs (contract §4):
 * - `updatedAt` on plans and relatives: the last-writer-wins version of their own fields;
 * - `tombstones`: deletions of plans and relatives, and undone contacts (`id` = `${relativeId}|${date}`);
 * - `sync.lastSyncedAt`: the server's `serverTime` of the last sync, sent back as `since`;
 * - `sync.acked`: the version of each item the server is known to hold. An item whose current version differs is
 *   pending. Comparing versions (not clocks) keeps sync correct when the device clock is off and lets a large
 *   first sync go out in several requests.
 *
 * Edit plans, relatives and settings in a store through `upsertPlan` / `updatePlan` / `deletePlan`,
 * `upsertRelative` / `updateRelative` / `deleteRelative` / `undoContact` and `updateSettings`: they keep
 * `updatedAt` and the tombstones right even when the entity-level helper did not.
 */
import { addDays, isIsoTime, isValidDate, isValidTime, isoMillis, nowIso, type IsoTime, type LocalDate, type LocalTime } from './dates.js';
import { HIJRI_OFFSET_MAX, HIJRI_OFFSET_MIN } from './hijri.js';
import { latestDate, undoLastContact, validateRelative, type PeopleCircle, type Relative } from './kinship.js';
import { cloneHabitLoop, mergeLogs, validatePlan, type HabitLoop, type Plan, type PlanLog } from './plan.js';
import type { Rule } from './rules.js';
import type { PrayerAnchor } from './prayer.js';
import { parseFardMarks, type FardMark } from './fard.js';
import { homeSectionsToStore, parseHomeSections, validateHomeSections, type HomeSectionPref } from './home.js';
import { cloneSinLoop, sanitizeCheckIn, validateCheckIn, validateProgram, validateSinLoop, type CheckIn, type SinProgram } from './sin-program.js';
import { parseDayStates, validateDayStates, type DayStateEntry } from './day-state.js';
import { cloneQadaPlan, parseQadaLogs, parseQadaPlan, validateQadaPlan, type QadaLog, type QadaPlan } from './qada.js';
import { parseReflections, type Reflection } from './reflection.js';
import { parseReadMarks, type ReadMark } from './reads.js';
import { isReciterKey } from './reciters.js';

export const STORE_VERSION = 2;
/** Most excused days kept (the newest win). */
export const MAX_EXCUSED_DAYS = 60;
/** An excused day can be set this many days back (today included); older ones are dropped on the next toggle. */
export const EXCUSE_WINDOW_DAYS = 90;

export interface Settings {
  /** −2…+2, see `hijri.ts`. */
  hijriOffset: number;
  reminderTimes?: LocalTime[];
  /** Free minutes per day, for `loadWarning`. 0…1440. */
  freeMinutesPerDay?: number;
  /**
   * «عذر (مرض أو سفر)»: days that neither break nor add to the streak, ascending, unique, at most
   * {@link MAX_EXCUSED_DAYS} (the newest kept). Absent or empty: none. Edit through {@link toggleExcusedDay}.
   */
  excusedDays?: LocalDate[];
  /**
   * «خصّص الرئيسية» (round 5, F-02 a): the member's order and visibility of the home sections (`home.ts`). Absent: the
   * defaults. Never stored equal to the defaults ({@link updateSettings} drops it), so it follows later default changes.
   */
  homeSections?: HomeSectionPref[];
  /** «الفرائض» (round 5, F-05 a): the five-prayer rows are on. Absent: off. */
  fardTracking?: true;
  /**
   * «حال يومي» (round 6, `day-state.ts`): the hard days and their state, ascending, at most {@link MAX_EXCUSED_DAYS}.
   * `sick` / `travel` days are also in {@link excusedDays}. Absent or empty: none.
   */
  dayStates?: DayStateEntry[];
  /** «قضاء الفوائت» (round 6, `qada.ts`): the owed prayers and the pace. Absent: none. */
  qada?: QadaPlan;
  /**
   * «تخفّف» rows in «العادات» are covered by default (round 6, C-02e): `false` when the member turned the covering off.
   * Never stored as `true` (absent = covered).
   */
  lightenCovered?: false;
  /** The chosen Quran reciter (round 6, `reciters.ts` key). Absent: the default reciter. */
  reciter?: string;
  /** ISO time of the last local edit. Absent while the settings were never edited (any synced version wins). */
  updatedAt?: IsoTime;
}

export type TombstoneKind = 'plan' | 'relative' | 'contact';

export interface Tombstone {
  kind: TombstoneKind;
  /** Plan or relative id; for a contact `${relativeId}|${date}` (see {@link contactId}). */
  id: string;
  deletedAt: IsoTime;
  /**
   * Plan tombstones only: the plan's log at deletion, plus logs that arrive while it is deleted. The server keeps
   * the logs of a soft-deleted plan, so a newer edit that brings the plan back must bring them back too.
   */
  log?: Record<string, number>;
  /** Plan tombstones only: the corrected days of {@link log} (see `Plan.logCorrectedAt`). */
  logCorrectedAt?: Record<string, IsoTime>;
}

export interface SyncState {
  /** The server's `serverTime` from the last successful sync; `null` before the first one. */
  lastSyncedAt: IsoTime | null;
  /** Item key → the version the server holds (see `sync.ts`). Managed by `applyServerChanges`. */
  acked: Record<string, string>;
}

export interface Store {
  v: 2;
  plans: Plan[];
  relatives: Relative[];
  /** LOCAL ONLY in clear. Never in a sync body, an export, logs or analytics; only sealed in the vault. */
  programs: SinProgram[];
  settings: Settings;
  tombstones: Tombstone[];
  sync: SyncState;
  /**
   * «الفرائض» marks (round 5, `fard.ts`), synced item by item. Absent or empty: none. Optional so older stores and
   * literals stay valid; read it as `store.fard ?? []`.
   */
  fard?: FardMark[];
  /** Habit reflections (round 6, `reflection.ts`), synced per (plan, date). */
  reflections?: Reflection[];
  /** «قضاء الفوائت» make-ups (round 6, `qada.ts`), synced per (date, prayer). */
  qadaLogs?: QadaLog[];
  /** Read marks of texts (round 6, `reads.ts`), synced per Quote id. */
  reads?: ReadMark[];
}

/** What may leave the device in clear: no `programs` (and no sync bookkeeping), by construction. */
export type SyncPayload = Omit<Store, 'programs' | 'sync'>;

export function emptyStore(): Store {
  return {
    v: 2,
    plans: [],
    relatives: [],
    programs: [],
    settings: { hijriOffset: 0 },
    tombstones: [],
    sync: { lastSyncedAt: null, acked: {} },
  };
}

/** The tombstone id of a contact. */
export function contactId(relativeId: string, date: string): string {
  return `${relativeId}|${date}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ── Canonical copies (known fields only, fixed key order) ─────────────────────────────────────────────────────

export function cloneRule(r: Rule): Rule {
  switch (r.kind) {
    case 'weekdays':
      return { kind: r.kind, days: [...r.days] };
    case 'everyNDays':
      return { kind: r.kind, n: r.n, anchor: r.anchor };
    case 'everyNWeeks':
      return { kind: r.kind, n: r.n, weekday: r.weekday, anchor: r.anchor };
    case 'hijriMonthDays':
      return { kind: r.kind, days: [...r.days] };
    case 'hijriYearly':
      return { kind: r.kind, month: r.month, day: r.day };
    case 'hijriWindow':
      return { kind: r.kind, month: r.month, fromDay: r.fromDay, toDay: r.toDay };
    case 'monthlyDay':
      return { kind: r.kind, day: r.day };
    case 'daily':
      return { kind: r.kind };
  }
}

export function clonePlan(p: Plan): Plan {
  const out: Plan = {
    id: p.id,
    deedSlug: p.deedSlug,
    title: p.title,
    unit: p.unit,
    amount: p.amount,
    activeDaysPerWeek: p.activeDaysPerWeek,
    slots: [...p.slots],
    createdOn: p.createdOn,
    amountChangedOn: p.amountChangedOn,
    log: { ...p.log },
  };
  if (p.habitKey !== undefined) out.habitKey = p.habitKey;
  if (p.ceiling !== undefined) out.ceiling = p.ceiling;
  if (p.ebb) out.ebb = { since: p.ebb.since };
  if (p.season) out.season = { amount: p.season.amount, until: p.season.until, previous: p.season.previous };
  if (p.rule) out.rule = cloneRule(p.rule);
  if (p.pausedOn !== undefined) out.pausedOn = p.pausedOn;
  if (p.resumedOn !== undefined) out.resumedOn = p.resumedOn;
  if (p.establishedOn !== undefined) out.establishedOn = p.establishedOn;
  if (p.slotAnchors !== undefined) out.slotAnchors = [...p.slotAnchors];
  if (p.loops !== undefined && p.loops.length > 0) out.loops = p.loops.map(cloneHabitLoop);
  if (p.updatedAt !== undefined) out.updatedAt = p.updatedAt;
  if (p.logCorrectedAt !== undefined) out.logCorrectedAt = { ...p.logCorrectedAt };
  if (p.minimum !== undefined) out.minimum = p.minimum;
  if (p.startAmount !== undefined) out.startAmount = p.startAmount;
  if (p.restartedOn !== undefined) out.restartedOn = p.restartedOn;
  return out;
}

export function cloneRelative(r: Relative): Relative {
  const out: Relative = {
    id: r.id,
    name: r.name,
    relation: r.relation,
    rule: cloneRule(r.rule) as Relative['rule'],
    history: [...r.history],
  };
  if (r.circle !== undefined && r.circle !== 'kin') out.circle = r.circle;
  if (r.lastContactedOn !== undefined) out.lastContactedOn = r.lastContactedOn;
  if (r.updatedAt !== undefined) out.updatedAt = r.updatedAt;
  return out;
}

function cloneCheckIn(c: CheckIn): CheckIn {
  const out: CheckIn = { date: c.date, value: c.value };
  if (c.note !== undefined) out.note = c.note;
  if (c.updatedAt !== undefined) out.updatedAt = c.updatedAt;
  if (c.triggers !== undefined) out.triggers = { ...c.triggers };
  if (c.goodDeed === true) out.goodDeed = true;
  if (c.nextLimit !== undefined) out.nextLimit = c.nextLimit;
  if (c.helped !== undefined) out.helped = c.helped;
  if (c.hard !== undefined) out.hard = c.hard;
  return out;
}

function cloneProgram(p: SinProgram): SinProgram {
  const out: SinProgram = {
    sinSlug: p.sinSlug,
    category: p.category,
    path: p.path,
    startedOn: p.startedOn,
    checkIns: p.endedAt !== undefined ? [] : p.checkIns.map(cloneCheckIn),
  };
  if (p.endedAt === undefined && p.loops !== undefined && p.loops.length > 0) out.loops = p.loops.map(cloneSinLoop);
  if (p.updatedAt !== undefined) out.updatedAt = p.updatedAt;
  if (p.endedAt !== undefined) out.endedAt = p.endedAt;
  return out;
}

/** The phase-2 plan fields (2026-10-31), present only when set (see {@link planFields}). */
export interface PlanStateFields {
  pausedOn?: LocalDate;
  resumedOn?: LocalDate;
  establishedOn?: LocalDate;
  /** Phase 6 (prayer anchors), only when the plan has one. */
  slotAnchors?: (PrayerAnchor | null)[];
  /** «حلقة العادة» (2026-11-01), only when the plan has at least one loop. */
  loops?: HabitLoop[];
  /** Round 6, each only when set: «القدر الأدنى», the start amount, the day progress restarted. */
  minimum?: number;
  startAmount?: number;
  restartedOn?: LocalDate;
}

/**
 * The fields of a plan that last-writer-wins versions (everything but `id`, `log` and `updatedAt`), in a fixed
 * order with `null` for absent values: the wire shape of contract §3. The phase-2 fields (`pausedOn`, `resumedOn`,
 * `establishedOn`) come last and only when set, so the canonical content of every older plan is unchanged (acked
 * versions stay valid and old clients compute the same content).
 */
export function planFields(p: Plan) {
  const state: PlanStateFields = {};
  if (p.pausedOn !== undefined) state.pausedOn = p.pausedOn;
  if (p.resumedOn !== undefined) state.resumedOn = p.resumedOn;
  if (p.establishedOn !== undefined) state.establishedOn = p.establishedOn;
  if (p.slotAnchors !== undefined && p.slotAnchors.some((a) => a !== null)) state.slotAnchors = [...p.slotAnchors];
  if (p.loops !== undefined && p.loops.length > 0) state.loops = p.loops.map(cloneHabitLoop);
  if (p.minimum !== undefined) state.minimum = p.minimum;
  if (p.startAmount !== undefined) state.startAmount = p.startAmount;
  if (p.restartedOn !== undefined) state.restartedOn = p.restartedOn;
  return {
    habitKey: p.habitKey ?? null,
    deedSlug: p.deedSlug,
    title: p.title,
    unit: p.unit,
    amount: p.amount,
    ceiling: p.ceiling ?? null,
    activeDaysPerWeek: p.activeDaysPerWeek,
    slots: [...p.slots],
    rule: p.rule ? cloneRule(p.rule) : null,
    createdOn: p.createdOn,
    amountChangedOn: p.amountChangedOn,
    ebbSince: p.ebb?.since ?? null,
    season: p.season ? { amount: p.season.amount, until: p.season.until, previous: p.season.previous } : null,
    ...state,
  };
}

/**
 * The last-writer-wins fields of a relative (contacts and `lastContactedOn` sync separately). `circle` only when it
 * is not `kin`, so older relatives keep their canonical content.
 */
export function relativeFields(r: Relative): { name: string; relation: string; rule: Rule; circle?: Exclude<PeopleCircle, 'kin'> } {
  const out: { name: string; relation: string; rule: Rule; circle?: Exclude<PeopleCircle, 'kin'> } = {
    name: r.name,
    relation: r.relation,
    rule: cloneRule(r.rule),
  };
  if (r.circle !== undefined && r.circle !== 'kin') out.circle = r.circle;
  return out;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── Parsing ───────────────────────────────────────────────────────────────────────────────────────────────────

function parseSettings(raw: unknown, upgradeTime: IsoTime | null): Settings {
  const s = isRecord(raw) ? raw : {};
  const off = s.hijriOffset;
  const settings: Settings = {
    hijriOffset:
      typeof off === 'number' && Number.isInteger(off) && off >= HIJRI_OFFSET_MIN && off <= HIJRI_OFFSET_MAX ? off : 0,
  };
  if (Array.isArray(s.reminderTimes)) settings.reminderTimes = s.reminderTimes.filter(isValidTime);
  const free = s.freeMinutesPerDay;
  if (typeof free === 'number' && Number.isInteger(free) && free >= 0 && free <= 1440) settings.freeMinutesPerDay = free;
  const excused = cleanExcusedDays(s.excusedDays);
  if (excused.length > 0) settings.excusedDays = excused;
  const home = parseHomeSections(s.homeSections);
  if (home) settings.homeSections = home;
  if (s.fardTracking === true) settings.fardTracking = true;
  const dayStates = parseDayStates(s.dayStates);
  if (dayStates.length > 0) settings.dayStates = dayStates;
  const qada = parseQadaPlan(s.qada);
  if (qada) settings.qada = qada;
  if (s.lightenCovered === false) settings.lightenCovered = false;
  if (isReciterKey(s.reciter)) settings.reciter = s.reciter;
  if (isIsoTime(s.updatedAt)) settings.updatedAt = s.updatedAt;
  else if (upgradeTime !== null && (settings.hijriOffset !== 0 || (settings.reminderTimes?.length ?? 0) > 0)) {
    // A v1 store whose settings were changed from the defaults: give them a version so they sync.
    settings.updatedAt = upgradeTime;
  }
  return settings;
}

/** Valid dates only, ascending and unique, the newest {@link MAX_EXCUSED_DAYS}. Never throws. */
export function cleanExcusedDays(raw: unknown): LocalDate[] {
  if (!Array.isArray(raw)) return [];
  const days = [...new Set(raw.filter(isValidDate))].sort();
  return days.slice(Math.max(0, days.length - MAX_EXCUSED_DAYS));
}

/** Keeps valid entries, then removes later duplicates of the same key. */
function keepValid<T>(raw: unknown, validate: (v: unknown) => string | null, clone: (v: T) => T, key: (v: T) => string): T[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of raw) {
    let ok = false;
    try {
      ok = validate(item) === null;
    } catch {
      ok = false;
    }
    if (!ok) continue;
    const v = clone(item as T);
    if (seen.has(key(v))) continue;
    seen.add(key(v));
    out.push(v);
  }
  return out;
}

/** Valid programs from untrusted input; a program keeps its good check-ins when some are invalid. */
export function parsePrograms(raw: unknown): SinProgram[] {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw.map((p) =>
    isRecord(p) && Array.isArray(p.checkIns)
      ? {
          ...p,
          checkIns: p.checkIns.map(sanitizeCheckIn).filter((c) => validateCheckIn(c) === null),
          // A damaged loop is dropped, never the program.
          ...(Array.isArray(p.loops) ? { loops: p.loops.filter((l) => validateSinLoop(l) === null) } : {}),
        }
      : p,
  );
  return keepValid<SinProgram>(cleaned, validateProgram, cloneProgram, (p) => p.sinSlug);
}

const TOMBSTONE_KINDS = new Set(['plan', 'relative', 'contact']);

function parseTombstones(raw: unknown): Tombstone[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, Tombstone>();
  for (const t of raw) {
    if (!isRecord(t) || !TOMBSTONE_KINDS.has(t.kind as string) || typeof t.id !== 'string' || t.id.length === 0) continue;
    if (!isIsoTime(t.deletedAt)) continue;
    if (t.kind === 'contact') {
      const sep = t.id.lastIndexOf('|');
      if (sep <= 0 || !isValidDate(t.id.slice(sep + 1))) continue;
    }
    const tomb: Tombstone = { kind: t.kind as TombstoneKind, id: t.id, deletedAt: t.deletedAt };
    if (tomb.kind === 'plan' && isRecord(t.log)) {
      const fixed = isRecord(t.logCorrectedAt) ? t.logCorrectedAt : {};
      const log: Record<string, number> = {};
      const corrected: Record<string, IsoTime> = {};
      for (const [d, v] of Object.entries(t.log)) {
        if (!isValidDate(d) || typeof v !== 'number' || !Number.isFinite(v) || v < 0) continue;
        const at = fixed[d];
        if (isIsoTime(at)) corrected[d] = at;
        else if (v === 0) continue;
        log[d] = v;
      }
      setTombLog(tomb, { log, logCorrectedAt: corrected });
    }
    const key = `${tomb.kind}:${tomb.id}`;
    const prev = byKey.get(key);
    if (!prev || isoMillis(tomb.deletedAt) > isoMillis(prev.deletedAt)) byKey.set(key, tomb);
  }
  return [...byKey.values()];
}

function parseSync(raw: unknown): SyncState {
  const s = isRecord(raw) ? raw : {};
  const acked: Record<string, string> = {};
  if (isRecord(s.acked)) for (const [k, v] of Object.entries(s.acked)) if (typeof v === 'string') acked[k] = v;
  return { lastSyncedAt: isIsoTime(s.lastSyncedAt) ? s.lastSyncedAt : null, acked };
}

/** Drops whichever of a live entity and its tombstone is older (an edit newer than the delete wins). */
function resolveTombstones(store: Store): Store {
  const plans = new Map(store.plans.map((p) => [p.id, p]));
  const relatives = new Map(store.relatives.map((r) => [r.id, r]));
  const dropPlans = new Set<string>();
  const dropRelatives = new Set<string>();
  const tombLog = (t: Tombstone): PlanLog => ({ log: t.log ?? {}, ...(t.logCorrectedAt ? { logCorrectedAt: t.logCorrectedAt } : {}) });
  const tombstones = store.tombstones.flatMap((t): Tombstone[] => {
    const plan = t.kind === 'plan' ? plans.get(t.id) : undefined;
    if (plan) {
      // The newer side survives and keeps both logs.
      if (isoMillis(t.deletedAt) > isoMillis(plan.updatedAt)) {
        dropPlans.add(t.id);
        const kept: Tombstone = { kind: t.kind, id: t.id, deletedAt: t.deletedAt };
        setTombLog(kept, mergeLogs(tombLog(t), plan));
        return [kept];
      }
      plans.set(t.id, withLog(plan, mergeLogs(plan, tombLog(t))));
      return [];
    }
    if (t.kind === 'relative' && relatives.has(t.id)) {
      if (isoMillis(t.deletedAt) > isoMillis(relatives.get(t.id)?.updatedAt)) dropRelatives.add(t.id);
      else return [];
    }
    if (t.kind === 'contact') {
      const sep = t.id.lastIndexOf('|');
      // A contact present in the history was logged again after the undo.
      if (relatives.get(t.id.slice(0, sep))?.history.includes(t.id.slice(sep + 1))) return [];
    }
    return [t];
  });
  return {
    ...store,
    plans: [...plans.values()].filter((p) => !dropPlans.has(p.id)),
    relatives: store.relatives.filter((r) => !dropRelatives.has(r.id)),
    tombstones,
  };
}

/**
 * Reads a store from parsed JSON or a JSON string. Never throws: unreadable input, or an unknown version, gives
 * an empty store; invalid entries are dropped one by one. A v1 store is upgraded to v2: plans and relatives get
 * `updatedAt = now`, settings changed from the defaults too; nothing else changes.
 */
export function parseStore(json: unknown, now: IsoTime = nowIso()): Store {
  let raw: unknown = json;
  if (typeof json === 'string') {
    try {
      raw = JSON.parse(json);
    } catch {
      return emptyStore();
    }
  }
  if (!isRecord(raw) || (raw.v !== 1 && raw.v !== 2)) return emptyStore();
  const upgradeTime = raw.v === 1 ? now : null;
  const stamp = <T extends { updatedAt?: IsoTime }>(x: T): T => (x.updatedAt === undefined || raw.v === 1 ? { ...x, updatedAt: now } : x);
  try {
    const store = resolveTombstones({
      v: 2,
      plans: keepValid<Plan>(raw.plans, validatePlan, clonePlan, (p) => p.id).map(stamp),
      relatives: keepValid<Relative>(raw.relatives, validateRelative, cloneRelative, (r) => r.id).map(stamp),
      programs: parsePrograms(raw.programs),
      settings: parseSettings(raw.settings, upgradeTime),
      tombstones: raw.v === 2 ? parseTombstones(raw.tombstones) : [],
      sync: raw.v === 2 ? parseSync(raw.sync) : { lastSyncedAt: null, acked: {} },
    });
    // Present only when there is a mark, so stores without «الفرائض» keep their exact shape (same for round 6 lists).
    const out: Store = { ...store };
    const fard = parseFardMarks(raw.fard);
    if (fard.length > 0) out.fard = fard;
    const reflections = parseReflections(raw.reflections);
    if (reflections.length > 0) out.reflections = reflections;
    const qadaLogs = parseQadaLogs(raw.qadaLogs);
    if (qadaLogs.length > 0) out.qadaLogs = qadaLogs;
    const reads = parseReadMarks(raw.reads);
    if (reads.length > 0) out.reads = reads;
    return out;
  } catch {
    return emptyStore();
  }
}

/** JSON text for on-device storage (localStorage, chrome.storage.local, AsyncStorage). Includes programs. */
export function serializeStore(store: Store): string {
  return JSON.stringify(parseStore(store as unknown));
}

/** What may leave the device in clear: everything except sin programs (and sync bookkeeping). */
export function exportForSync(store: Store): SyncPayload {
  const clean = parseStore(store as unknown);
  const out: SyncPayload = { v: clean.v, plans: clean.plans, relatives: clean.relatives, settings: clean.settings, tombstones: clean.tombstones };
  if (clean.fard) out.fard = clean.fard;
  if (clean.reflections) out.reflections = clean.reflections;
  if (clean.qadaLogs) out.qadaLogs = clean.qadaLogs;
  if (clean.reads) out.reads = clean.reads;
  return out;
}

// ── Store-level edits ─────────────────────────────────────────────────────────────────────────────────────────

function withoutTombstone(tombstones: readonly Tombstone[], kind: TombstoneKind, id: string): Tombstone[] {
  return tombstones.filter((t) => !(t.kind === kind && t.id === id));
}

function withTombstone(tombstones: readonly Tombstone[], kind: TombstoneKind, id: string, deletedAt: IsoTime, log?: PlanLog): Tombstone[] {
  const tomb: Tombstone = { kind, id, deletedAt };
  if (log) setTombLog(tomb, log);
  return [...withoutTombstone(tombstones, kind, id), tomb];
}

/** Puts a plan log on a plan tombstone, leaving out empty parts. Mutates `tomb`. */
export function setTombLog(tomb: Tombstone, log: PlanLog): void {
  if (Object.keys(log.log).length > 0) tomb.log = { ...log.log };
  else delete tomb.log;
  if (log.logCorrectedAt && Object.keys(log.logCorrectedAt).length > 0) tomb.logCorrectedAt = { ...log.logCorrectedAt };
  else delete tomb.logCorrectedAt;
}

/** The plan with `log` and `logCorrectedAt` replaced by `merged`. */
export function withLog(plan: Plan, merged: PlanLog): Plan {
  const out: Plan = { ...plan, log: merged.log };
  if (merged.logCorrectedAt) out.logCorrectedAt = merged.logCorrectedAt;
  else delete out.logCorrectedAt;
  return out;
}

/**
 * Adds or replaces a plan. When its versioned fields changed, `updatedAt` becomes `now` (or the newer
 * `updatedAt` an entity helper already set). Log changes alone keep `updatedAt`. Throws when invalid.
 */
export function upsertPlan(store: Store, plan: Plan, now: IsoTime = nowIso()): Store {
  const err = validatePlan(plan);
  if (err) throw new RangeError(`Invalid plan: ${err}`);
  const existing = store.plans.find((p) => p.id === plan.id);
  let updatedAt = plan.updatedAt ?? now;
  if (existing) {
    if (sameJson(planFields(existing), planFields(plan))) updatedAt = existing.updatedAt ?? updatedAt;
    else if (plan.updatedAt === undefined || plan.updatedAt === existing.updatedAt) updatedAt = now;
  }
  const tomb = store.tombstones.find((t) => t.kind === 'plan' && t.id === plan.id);
  let next: Plan = { ...clonePlan(plan), updatedAt };
  if (tomb?.log) next = withLog(next, mergeLogs(next, { log: tomb.log, ...(tomb.logCorrectedAt ? { logCorrectedAt: tomb.logCorrectedAt } : {}) }));
  const plans = existing ? store.plans.map((p) => (p.id === plan.id ? next : p)) : [...store.plans, next];
  return { ...store, plans, tombstones: withoutTombstone(store.tombstones, 'plan', plan.id) };
}

/** Applies `change` to one plan through {@link upsertPlan}. Throws when the plan does not exist. */
export function updatePlan(store: Store, id: string, change: (plan: Plan) => Plan, now: IsoTime = nowIso()): Store {
  const existing = store.plans.find((p) => p.id === id);
  if (!existing) throw new RangeError('Unknown plan');
  return upsertPlan(store, { ...change(existing), id }, now);
}

/** Removes a plan and records a tombstone that keeps its log (see {@link Tombstone.log}). Unknown ids still get one. */
export function deletePlan(store: Store, id: string, now: IsoTime = nowIso()): Store {
  return {
    ...store,
    plans: store.plans.filter((p) => p.id !== id),
    tombstones: withTombstone(store.tombstones, 'plan', id, now, store.plans.find((p) => p.id === id)),
  };
}

/**
 * Adds or replaces a relative. Name, relation or rule changes set `updatedAt`; contacts removed from the history
 * become contact tombstones, contacts added clear theirs; `lastContactedOn` follows the history. Throws when invalid.
 */
export function upsertRelative(store: Store, relative: Relative, now: IsoTime = nowIso()): Store {
  const err = validateRelative(relative);
  if (err) throw new RangeError(`Invalid relative: ${err}`);
  const existing = store.relatives.find((r) => r.id === relative.id);
  let updatedAt = relative.updatedAt ?? now;
  if (existing) {
    if (sameJson(relativeFields(existing), relativeFields(relative))) updatedAt = existing.updatedAt ?? updatedAt;
    else if (relative.updatedAt === undefined || relative.updatedAt === existing.updatedAt) updatedAt = now;
  }
  const next = { ...cloneRelative(relative), updatedAt };
  const last = latestDate(next.history);
  if (last === undefined) delete next.lastContactedOn;
  else next.lastContactedOn = last;
  let tombstones = withoutTombstone(store.tombstones, 'relative', relative.id);
  for (const date of existing?.history ?? []) {
    if (!next.history.includes(date)) tombstones = withTombstone(tombstones, 'contact', contactId(relative.id, date), now);
  }
  for (const date of next.history) tombstones = withoutTombstone(tombstones, 'contact', contactId(relative.id, date));
  const relatives = existing ? store.relatives.map((r) => (r.id === relative.id ? next : r)) : [...store.relatives, next];
  return { ...store, relatives, tombstones };
}

/** Applies `change` to one relative through {@link upsertRelative}. Throws when the relative does not exist. */
export function updateRelative(store: Store, id: string, change: (r: Relative) => Relative, now: IsoTime = nowIso()): Store {
  const existing = store.relatives.find((r) => r.id === id);
  if (!existing) throw new RangeError('Unknown relative');
  return upsertRelative(store, { ...change(existing), id }, now);
}

/** Removes a relative and records a tombstone (the server drops its contacts with it). */
export function deleteRelative(store: Store, id: string, now: IsoTime = nowIso()): Store {
  return {
    ...store,
    relatives: store.relatives.filter((r) => r.id !== id),
    tombstones: withTombstone(store.tombstones, 'relative', id, now),
  };
}

/** «تراجعت»: undoes the relative's most recently logged contact and records a contact tombstone. */
export function undoContact(store: Store, relativeId: string, now: IsoTime = nowIso()): Store {
  return updateRelative(store, relativeId, undoLastContact, now);
}

/**
 * Takes back the contact logged on `date` (any date, not only the latest) and records a contact tombstone, so the
 * removal also reaches the user's other devices. `lastContactedOn` follows the remaining history.
 */
export function removeContact(store: Store, relativeId: string, date: string, now: IsoTime = nowIso()): Store {
  return updateRelative(
    store,
    relativeId,
    (r) => {
      const history = r.history.filter((d) => d !== date);
      const out: Relative = { ...r, history };
      const last = latestDate(history);
      if (last === undefined) delete out.lastContactedOn;
      else out.lastContactedOn = last;
      return out;
    },
    now,
  );
}

/** Changes settings and stamps `updatedAt`. Throws on an invalid value. */
export function updateSettings(store: Store, patch: Partial<Omit<Settings, 'updatedAt'>>, now: IsoTime = nowIso()): Store {
  const merged = { ...store.settings, ...patch };
  const parsed = parseSettings(merged, null);
  if (parsed.hijriOffset !== merged.hijriOffset) throw new RangeError('Invalid hijriOffset');
  if (merged.reminderTimes !== undefined && parsed.reminderTimes?.length !== merged.reminderTimes.length) {
    throw new RangeError('Invalid reminder time');
  }
  if (merged.freeMinutesPerDay !== undefined && parsed.freeMinutesPerDay !== merged.freeMinutesPerDay) {
    throw new RangeError('Invalid freeMinutesPerDay');
  }
  if (merged.excusedDays !== undefined && !merged.excusedDays.every(isValidDate)) throw new RangeError('Invalid excused day');
  if ('homeSections' in patch) {
    if (patch.homeSections !== undefined && validateHomeSections(patch.homeSections) !== null) throw new RangeError('Invalid homeSections');
    const home = homeSectionsToStore(patch.homeSections);
    if (home) parsed.homeSections = home;
    else delete parsed.homeSections;
  }
  if ('fardTracking' in patch && patch.fardTracking !== undefined && patch.fardTracking !== true) throw new RangeError('Invalid fardTracking');
  if ('dayStates' in patch && patch.dayStates !== undefined && validateDayStates(patch.dayStates) !== null) throw new RangeError('Invalid dayStates');
  if ('dayStates' in patch && (patch.dayStates === undefined || patch.dayStates.length === 0)) delete parsed.dayStates;
  if ('qada' in patch) {
    if (patch.qada !== undefined && validateQadaPlan(patch.qada) !== null) throw new RangeError('Invalid qada');
    if (patch.qada === undefined) delete parsed.qada;
    else parsed.qada = cloneQadaPlan(patch.qada);
  }
  if ('lightenCovered' in patch && patch.lightenCovered !== undefined && patch.lightenCovered !== false) throw new RangeError('Invalid lightenCovered');
  if ('reciter' in patch && patch.reciter !== undefined && !isReciterKey(patch.reciter)) throw new RangeError('Invalid reciter');
  return { ...store, settings: { ...parsed, updatedAt: now } };
}

/** «خصّص الرئيسية»: stores the member's section order (the defaults are stored as absent). Throws on an invalid list. */
export function setHomeSections(store: Store, list: readonly HomeSectionPref[] | null, now: IsoTime = nowIso()): Store {
  return updateSettings(store, { homeSections: list === null ? undefined : [...list] }, now);
}

/** «الفرائض» on or off. Turning it off keeps the marks (they reappear when it is turned on again). */
export function setFardTracking(store: Store, on: boolean, now: IsoTime = nowIso()): Store {
  if (fardOnInSettings(store.settings) === on) return store;
  const settings: Settings = { ...store.settings };
  if (on) settings.fardTracking = true;
  else delete settings.fardTracking;
  return { ...store, settings: { ...settings, updatedAt: now } };
}

function fardOnInSettings(s: Settings): boolean {
  return s.fardTracking === true;
}

/** True when `date` is marked «عذر» (sick or travelling). */
export function isExcused(store: Pick<Store, 'settings'>, date: LocalDate): boolean {
  return store.settings.excusedDays?.includes(date) ?? false;
}

/** True when `date` may be marked or unmarked as excused on `today`: not in the future, within {@link EXCUSE_WINDOW_DAYS}. */
export function canExcuse(date: LocalDate, today: LocalDate): boolean {
  return isValidDate(date) && date <= today && date > addDays(today, -EXCUSE_WINDOW_DAYS);
}

/**
 * Marks or unmarks `date` as «عذر». Days older than {@link EXCUSE_WINDOW_DAYS} are dropped on the way, and at most
 * {@link MAX_EXCUSED_DAYS} are kept. Throws when {@link canExcuse} is false.
 */
export function toggleExcusedDay(store: Store, date: LocalDate, today: LocalDate, now: IsoTime = nowIso()): Store {
  if (!canExcuse(date, today)) throw new RangeError('This day cannot be excused');
  const floor = addDays(today, -EXCUSE_WINDOW_DAYS);
  const current = (store.settings.excusedDays ?? []).filter((d) => d > floor);
  const next = current.includes(date) ? current.filter((d) => d !== date) : [...current, date];
  return updateSettings(store, { excusedDays: cleanExcusedDays(next) }, now);
}
