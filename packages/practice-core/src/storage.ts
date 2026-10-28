/**
 * The on-device store: one versioned JSON envelope for plans, relatives, sin programs and settings.
 *
 * `parseStore` is defensive: it never throws, drops entries that fail validation, and copies only known
 * fields (so a stray field can never ride along into an export). `exportForSync` is the only shape that may
 * ever leave the device, and it has no `programs` key: sin-program data is local only (roadmap §0.1).
 */
import { isValidTime, type LocalTime } from './dates.js';
import { HIJRI_OFFSET_MAX, HIJRI_OFFSET_MIN } from './hijri.js';
import { validateRelative, type Relative } from './kinship.js';
import { validatePlan, type Plan } from './plan.js';
import type { Rule } from './rules.js';
import { validateCheckIn, validateProgram, type CheckIn, type SinProgram } from './sin-program.js';

export const STORE_VERSION = 1;

export interface Settings {
  /** −2…+2, see `hijri.ts`. */
  hijriOffset: number;
  reminderTimes?: LocalTime[];
}

export interface Store {
  v: 1;
  plans: Plan[];
  relatives: Relative[];
  /** LOCAL ONLY. Never synced, exported to a server, logged or backed up by us. */
  programs: SinProgram[];
  settings: Settings;
}

/** The subset that may be synced to an account later. No `programs`, by construction. */
export type SyncPayload = Omit<Store, 'programs'>;

export function emptyStore(): Store {
  return { v: 1, plans: [], relatives: [], programs: [], settings: { hijriOffset: 0 } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function clonePlan(p: Plan): Plan {
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
  if (p.ceiling !== undefined) out.ceiling = p.ceiling;
  if (p.ebb) out.ebb = { since: p.ebb.since };
  if (p.season) out.season = { amount: p.season.amount, until: p.season.until, previous: p.season.previous };
  return out;
}

function cloneRule(r: Rule): Rule {
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

function cloneRelative(r: Relative): Relative {
  const out: Relative = {
    id: r.id,
    name: r.name,
    relation: r.relation,
    rule: cloneRule(r.rule) as Relative['rule'],
    history: [...r.history],
  };
  if (r.lastContactedOn !== undefined) out.lastContactedOn = r.lastContactedOn;
  return out;
}

function cloneCheckIn(c: CheckIn): CheckIn {
  const out: CheckIn = { date: c.date, value: c.value };
  if (c.note !== undefined) out.note = c.note;
  return out;
}

function cloneProgram(p: SinProgram): SinProgram {
  return {
    sinSlug: p.sinSlug,
    category: p.category,
    path: p.path,
    startedOn: p.startedOn,
    checkIns: p.checkIns.map(cloneCheckIn),
  };
}

function parseSettings(raw: unknown): Settings {
  const s = isRecord(raw) ? raw : {};
  const off = s.hijriOffset;
  const settings: Settings = {
    hijriOffset:
      typeof off === 'number' && Number.isInteger(off) && off >= HIJRI_OFFSET_MIN && off <= HIJRI_OFFSET_MAX ? off : 0,
  };
  if (Array.isArray(s.reminderTimes)) settings.reminderTimes = s.reminderTimes.filter(isValidTime);
  return settings;
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

/**
 * Reads a store from parsed JSON or a JSON string. Never throws: unreadable input, or an unknown version,
 * gives an empty store; invalid entries are dropped one by one.
 */
export function parseStore(json: unknown): Store {
  let raw: unknown = json;
  if (typeof json === 'string') {
    try {
      raw = JSON.parse(json);
    } catch {
      return emptyStore();
    }
  }
  if (!isRecord(raw) || raw.v !== STORE_VERSION) return emptyStore();
  // A program with one bad check-in keeps its good check-ins instead of being dropped.
  const programs = keepValid<SinProgram>(
    Array.isArray(raw.programs)
      ? raw.programs.map((p) =>
          isRecord(p) && Array.isArray(p.checkIns) ? { ...p, checkIns: p.checkIns.filter((c) => validateCheckIn(c) === null) } : p,
        )
      : [],
    validateProgram,
    cloneProgram,
    (p) => p.sinSlug,
  );
  return {
    v: 1,
    plans: keepValid<Plan>(raw.plans, validatePlan, clonePlan, (p) => p.id),
    relatives: keepValid<Relative>(raw.relatives, validateRelative, cloneRelative, (r) => r.id),
    programs,
    settings: parseSettings(raw.settings),
  };
}

/** JSON text for on-device storage (localStorage, chrome.storage.local, AsyncStorage). Includes programs. */
export function serializeStore(store: Store): string {
  return JSON.stringify(parseStore(store as unknown));
}

/** What may be synced to an account: everything except sin programs. */
export function exportForSync(store: Store): SyncPayload {
  const clean = parseStore(store as unknown);
  return { v: clean.v, plans: clean.plans, relatives: clean.relatives, settings: clean.settings };
}

