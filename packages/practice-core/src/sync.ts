/**
 * Incremental sync with `POST /v1/me/practice/sync` (docs/plan/2026-10-practice-sync-contract.md §3–4).
 *
 * `localChanges` builds the request's `changes`; `applyServerChanges` merges a response (or a GET body) with the
 * same rules as the server:
 *
 * | Kind | Rule |
 * | --- | --- |
 * | plan, relative, settings | last writer wins by `clientUpdatedAt`; a tombstone carries one too and wins only when newer. Equal times: a tombstone beats a live record, then the larger canonical JSON wins (so every replica picks the same) |
 * | log (plan, date) | `max(stored, incoming)`: logging never goes down |
 * | contact (relative, date) | union; `deleted: true` removes it; a later non-deleted write restores it. A local change not yet pushed is kept (it is the later write) |
 *
 * Pending detection compares versions, not clocks: `store.sync.acked` remembers the version of each item the server
 * holds (an item is acked when the server returns exactly the local version). A device with a wrong clock still
 * syncs every edit, and a large first sync can go out in several requests (`maxItems`).
 *
 * Sin programs never appear here: every body is built field by field from plans, relatives and settings.
 */
import { isIsoTime, isValidDate, isValidTime, isoMillis, type IsoTime, type LocalDate, type LocalTime } from './dates.js';
import { HIJRI_OFFSET_MAX, HIJRI_OFFSET_MIN } from './hijri.js';
import { latestDate, validateRelative, type KinshipRule, type Relative } from './kinship.js';
import { validatePlan, type Plan, type PlanUnit } from './plan.js';
import type { Rule } from './rules.js';
import {
  contactId,
  planFields,
  relativeFields,
  type Settings,
  type Store,
  type Tombstone,
  type TombstoneKind,
} from './storage.js';

// ── Wire shapes (contract §3) ─────────────────────────────────────────────────────────────────────────────────

export type WirePlanFields = ReturnType<typeof planFields>;
export type WirePlan = WirePlanFields & { id: string; clientUpdatedAt: IsoTime; deletedAt: null };
/** A deleted plan. The client sends only these three fields; the server may return the last fields too. */
export type WirePlanDeleted = Partial<WirePlanFields> & { id: string; clientUpdatedAt: IsoTime; deletedAt: IsoTime };
export type WirePlanItem = WirePlan | WirePlanDeleted;

export interface WireLog {
  planId: string;
  date: LocalDate;
  amount: number;
}

export type WireRelativeFields = ReturnType<typeof relativeFields>;
export type WireRelative = WireRelativeFields & {
  id: string;
  lastContactedOn: LocalDate | null;
  clientUpdatedAt: IsoTime;
  deletedAt: null;
};
export type WireRelativeDeleted = Partial<WireRelativeFields> & {
  id: string;
  lastContactedOn?: LocalDate | null;
  clientUpdatedAt: IsoTime;
  deletedAt: IsoTime;
};
export type WireRelativeItem = WireRelative | WireRelativeDeleted;

export interface WireContact {
  relativeId: string;
  date: LocalDate;
  deleted: boolean;
}

export interface WireSettings {
  hijriOffset: number;
  reminderTimes: LocalTime[];
  freeMinutesPerDay: number | null;
  clientUpdatedAt: IsoTime;
}

/** `changes` of `POST /v1/me/practice/sync`. */
export interface SyncChanges {
  settings?: WireSettings;
  plans: WirePlanItem[];
  logs: WireLog[];
  relatives: WireRelativeItem[];
  contacts: WireContact[];
}

export interface SyncRequest {
  since: IsoTime | null;
  changes: SyncChanges;
}

/** Settings as the server returns them; the version is `clientUpdatedAt`, else `updatedAt`. */
export interface ServerSettings {
  hijriOffset: number;
  reminderTimes: LocalTime[];
  freeMinutesPerDay: number | null;
  clientUpdatedAt?: IsoTime;
  updatedAt?: IsoTime;
}

/** `data` of `GET /v1/me/practice` and of the sync response. */
export interface SyncResponse {
  serverTime: IsoTime;
  settings: ServerSettings | null;
  plans: WirePlanItem[];
  logs: WireLog[];
  relatives: WireRelativeItem[];
  contacts: WireContact[];
}

/** The contract's limit on items per sync request. */
export const MAX_SYNC_ITEMS = 500;

// ── Versions and the shared merge rules ───────────────────────────────────────────────────────────────────────

export interface Version {
  /** Milliseconds; `-Infinity` for a record never edited. */
  time: number;
  deleted: boolean;
  /** Canonical JSON of the versioned fields ('' for a tombstone). */
  content: string;
}

/**
 * Orders two versions of the same record: > 0 when `a` wins, < 0 when `b` wins, 0 when identical.
 * Later time wins; at equal times a tombstone wins; then the larger canonical JSON. Commutative and total, so
 * every replica (and the server) picks the same winner whatever the order of arrival.
 */
export function compareVersions(a: Version, b: Version): number {
  if (a.time !== b.time) return a.time > b.time ? 1 : -1;
  if (a.deleted !== b.deleted) return a.deleted ? 1 : -1;
  if (a.content === b.content) return 0;
  return a.content > b.content ? 1 : -1;
}

/** Log merge: logging never goes down. */
export function mergeLogAmount(stored: number | undefined, incoming: number): number {
  return Math.max(stored ?? 0, incoming);
}

/** FNV-1a 32-bit, to keep acked versions short. Not a security measure. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function versionKey(v: Version): string {
  return `${v.deleted ? 'D' : 'L'}|${Number.isFinite(v.time) ? v.time : '-'}|${v.deleted ? '' : hash(v.content)}`;
}

const planVersion = (p: Plan): Version => ({ time: isoMillis(p.updatedAt), deleted: false, content: JSON.stringify(planFields(p)) });
const relativeVersion = (r: Relative): Version => ({
  time: isoMillis(r.updatedAt),
  deleted: false,
  content: JSON.stringify(relativeFields(r)),
});
const tombVersion = (t: Tombstone): Version => ({ time: isoMillis(t.deletedAt), deleted: true, content: '' });

function settingsContent(s: { hijriOffset: number; reminderTimes?: LocalTime[]; freeMinutesPerDay?: number | null }): string {
  return JSON.stringify({ hijriOffset: s.hijriOffset, reminderTimes: s.reminderTimes ?? [], freeMinutesPerDay: s.freeMinutesPerDay ?? null });
}
const settingsVersion = (s: Settings): Version => ({ time: isoMillis(s.updatedAt), deleted: false, content: settingsContent(s) });

const toIso = (ms: number): IsoTime => new Date(ms).toISOString();
const planKey = (id: string) => `plan:${id}`;
const relativeKey = (id: string) => `relative:${id}`;
const logKey = (planId: string, date: string) => `log:${planId}|${date}`;
const contactKey = (relativeId: string, date: string) => `contact:${relativeId}|${date}`;

// ── Local changes ─────────────────────────────────────────────────────────────────────────────────────────────

function wirePlan(p: Plan): WirePlan {
  return { id: p.id, ...planFields(p), clientUpdatedAt: toIso(isoMillis(p.updatedAt) === -Infinity ? 0 : isoMillis(p.updatedAt)), deletedAt: null };
}

function wireRelative(r: Relative): WireRelative {
  return {
    id: r.id,
    ...relativeFields(r),
    lastContactedOn: latestDate(r.history) ?? null,
    clientUpdatedAt: toIso(isoMillis(r.updatedAt) === -Infinity ? 0 : isoMillis(r.updatedAt)),
    deletedAt: null,
  };
}

function wireDeleted(t: Tombstone): { id: string; clientUpdatedAt: IsoTime; deletedAt: IsoTime } {
  const at = toIso(isoMillis(t.deletedAt));
  return { id: t.id, clientUpdatedAt: at, deletedAt: at };
}

function tombstoneMap(store: Store): Map<string, Tombstone> {
  return new Map(store.tombstones.map((t) => [`${t.kind}:${t.id}`, t]));
}

/** Local state of one contact: present, removed (tombstone, or acked present but gone), or unknown here. */
function localContactState(store: Store, tombs: Map<string, Tombstone>, rel: Relative, date: string): 'live' | 'deleted' | null {
  if (rel.history.includes(date)) return 'live';
  if (tombs.has(`contact:${contactId(rel.id, date)}`)) return 'deleted';
  // Acked 'live' but gone: removed here (e.g. undoLastContact outside updateRelative). Acked 'deleted': known removal.
  const acked = store.sync.acked[contactKey(rel.id, date)];
  if (acked === 'live' || acked === 'deleted') return 'deleted';
  return null;
}

export interface LocalChangesOptions {
  /** Default {@link MAX_SYNC_ITEMS}. Settings count as one item. Plans and relatives go before logs and contacts. */
  maxItems?: number;
  /** Send everything, ignoring what the server already holds (a full re-push). */
  includeAcked?: boolean;
}

/** The `changes` body: every item whose version the server does not hold yet. Never contains programs. */
export function localChanges(store: Store, opts: LocalChangesOptions = {}): SyncChanges {
  const max = opts.maxItems ?? MAX_SYNC_ITEMS;
  const acked = opts.includeAcked ? {} : store.sync.acked;
  const pending = (key: string, version: string) => acked[key] !== version;
  const tombs = tombstoneMap(store);
  let budget = max;
  const take = <T>(list: T[], item: T) => {
    if (budget > 0) {
      list.push(item);
      budget--;
    }
  };
  const out: SyncChanges = { plans: [], logs: [], relatives: [], contacts: [] };

  const s = store.settings;
  if (s.updatedAt !== undefined && pending('settings', versionKey(settingsVersion(s))) && budget > 0) {
    out.settings = {
      hijriOffset: s.hijriOffset,
      reminderTimes: [...(s.reminderTimes ?? [])],
      freeMinutesPerDay: s.freeMinutesPerDay ?? null,
      clientUpdatedAt: toIso(isoMillis(s.updatedAt)),
    };
    budget--;
  }
  for (const p of store.plans) if (pending(planKey(p.id), versionKey(planVersion(p)))) take(out.plans, wirePlan(p));
  for (const t of store.tombstones) {
    if (t.kind === 'plan' && pending(planKey(t.id), versionKey(tombVersion(t)))) take(out.plans, wireDeleted(t));
  }
  for (const r of store.relatives) if (pending(relativeKey(r.id), versionKey(relativeVersion(r)))) take(out.relatives, wireRelative(r));
  for (const t of store.tombstones) {
    if (t.kind === 'relative' && pending(relativeKey(t.id), versionKey(tombVersion(t)))) take(out.relatives, wireDeleted(t));
  }
  // Logs and contacts only once every plan and relative fits, so the server knows each parent.
  const parentsComplete = budget > 0;
  if (parentsComplete) {
    for (const p of store.plans) {
      for (const date of Object.keys(p.log).sort()) {
        const amount = p.log[date] as number;
        if (amount > 0 && pending(logKey(p.id, date), String(amount))) take(out.logs, { planId: p.id, date, amount });
      }
    }
    for (const r of store.relatives) {
      const dates = new Set(r.history);
      for (const t of store.tombstones) {
        if (t.kind === 'contact' && t.id.startsWith(`${r.id}|`)) dates.add(t.id.slice(r.id.length + 1));
      }
      for (const key of Object.keys(store.sync.acked)) {
        if (key.startsWith(`contact:${r.id}|`)) dates.add(key.slice(`contact:${r.id}|`.length));
      }
      for (const date of [...dates].sort()) {
        const state = localContactState(store, tombs, r, date);
        if (state !== null && pending(contactKey(r.id, date), state)) {
          take(out.contacts, { relativeId: r.id, date, deleted: state === 'deleted' });
        }
      }
    }
  }
  return out;
}

/** The request body: `since` = the last `serverTime`, plus {@link localChanges}. */
export function buildSyncRequest(store: Store, opts: LocalChangesOptions = {}): SyncRequest {
  return { since: store.sync.lastSyncedAt, changes: localChanges(store, opts) };
}

/** Total items in a changes body (settings count as one). */
export function countChanges(changes: SyncChanges): number {
  return (changes.settings ? 1 : 0) + changes.plans.length + changes.logs.length + changes.relatives.length + changes.contacts.length;
}

// ── Applying a server response ────────────────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function planFromWire(w: Record<string, unknown>, log: Record<string, number>, updatedAt: IsoTime): Plan | null {
  const plan: Record<string, unknown> = {
    id: w.id,
    deedSlug: w.deedSlug,
    title: w.title,
    unit: w.unit as PlanUnit,
    amount: w.amount,
    activeDaysPerWeek: w.activeDaysPerWeek,
    slots: Array.isArray(w.slots) ? [...w.slots] : w.slots,
    createdOn: w.createdOn,
    amountChangedOn: w.amountChangedOn,
    log: { ...log },
    updatedAt,
  };
  if (w.habitKey !== null && w.habitKey !== undefined) plan.habitKey = w.habitKey;
  if (w.ceiling !== null && w.ceiling !== undefined) plan.ceiling = w.ceiling;
  if (w.rule !== null && w.rule !== undefined) plan.rule = w.rule as Rule;
  if (w.ebbSince !== null && w.ebbSince !== undefined) plan.ebb = { since: w.ebbSince };
  if (isRecord(w.season)) plan.season = { amount: w.season.amount, until: w.season.until, previous: w.season.previous };
  try {
    return validatePlan(plan) === null ? (plan as unknown as Plan) : null;
  } catch {
    return null;
  }
}

function relativeFromWire(w: Record<string, unknown>, history: LocalDate[], updatedAt: IsoTime): Relative | null {
  const rel: Record<string, unknown> = { id: w.id, name: w.name, relation: w.relation, rule: w.rule as KinshipRule, history: [...history], updatedAt };
  try {
    return validateRelative(rel) === null ? (rel as unknown as Relative) : null;
  } catch {
    return null;
  }
}

function wireVersion(w: Record<string, unknown>, content: string): Version | null {
  if (!isIsoTime(w.clientUpdatedAt)) return null;
  const deleted = w.deletedAt !== null && w.deletedAt !== undefined;
  if (deleted && !isIsoTime(w.deletedAt)) return null;
  return { time: isoMillis(w.clientUpdatedAt), deleted, content: deleted ? '' : content };
}

/**
 * Merges a server response into the store (pure; returns a new store) and sets `sync.lastSyncedAt` to
 * `serverTime`. Accepts the `data` object or the whole `{ data }` envelope. Invalid items are skipped; a response
 * without a valid `serverTime` throws a TypeError and changes nothing.
 */
export function applyServerChanges(store: Store, response: SyncResponse | { data: SyncResponse } | unknown): Store {
  const body = isRecord(response) && isRecord(response.data) ? response.data : response;
  if (!isRecord(body) || !isIsoTime(body.serverTime)) throw new TypeError('Invalid sync response: serverTime missing');
  const serverTime = body.serverTime;

  const acked: Record<string, string> = { ...store.sync.acked };
  const plans = new Map(store.plans.map((p) => [p.id, p]));
  const relatives = new Map(store.relatives.map((r) => [r.id, r]));
  const tombs = new Map(store.tombstones.map((t) => [`${t.kind}:${t.id}`, t]));
  const setTomb = (kind: TombstoneKind, id: string, deletedAt: IsoTime, log?: Record<string, number>) => {
    const t: Tombstone = { kind, id, deletedAt };
    if (log && Object.keys(log).length > 0) t.log = { ...log };
    tombs.set(`${kind}:${id}`, t);
  };

  // Settings.
  let settings = store.settings;
  if (isRecord(body.settings)) {
    const w = body.settings;
    const time = isIsoTime(w.clientUpdatedAt) ? w.clientUpdatedAt : isIsoTime(w.updatedAt) ? w.updatedAt : null;
    const off = w.hijriOffset;
    const free = w.freeMinutesPerDay;
    const valid =
      time !== null &&
      typeof off === 'number' &&
      Number.isInteger(off) &&
      off >= HIJRI_OFFSET_MIN &&
      off <= HIJRI_OFFSET_MAX &&
      Array.isArray(w.reminderTimes) &&
      w.reminderTimes.every(isValidTime) &&
      (free === null || free === undefined || (typeof free === 'number' && Number.isInteger(free) && free >= 0 && free <= 1440));
    if (valid) {
      const incoming: Settings = { hijriOffset: off, updatedAt: time };
      if ((w.reminderTimes as LocalTime[]).length > 0) incoming.reminderTimes = [...(w.reminderTimes as LocalTime[])];
      if (typeof free === 'number') incoming.freeMinutesPerDay = free;
      const vIn = settingsVersion(incoming);
      if (compareVersions(settingsVersion(settings), vIn) < 0) settings = incoming;
      if (versionKey(settingsVersion(settings)) === versionKey(vIn)) acked.settings = versionKey(vIn);
    }
  }

  // Plans (before logs, so a log can find a plan created on another device).
  for (const item of arr(body.plans)) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0) continue;
    const id = item.id;
    const local = plans.get(id);
    const tomb = tombs.get(`plan:${id}`);
    const keptLog = local?.log ?? tomb?.log ?? {};
    const incomingPlan = item.deletedAt == null && isIsoTime(item.clientUpdatedAt) ? planFromWire(item, keptLog, item.clientUpdatedAt) : null;
    const vIn = wireVersion(item, incomingPlan ? JSON.stringify(planFields(incomingPlan)) : '');
    if (!vIn || (!vIn.deleted && !incomingPlan)) continue;
    const vLocal = local ? planVersion(local) : tomb ? tombVersion(tomb) : null;
    if (vLocal === null || compareVersions(vLocal, vIn) < 0) {
      if (vIn.deleted) {
        plans.delete(id);
        setTomb('plan', id, item.clientUpdatedAt as IsoTime, keptLog);
      } else {
        plans.set(id, incomingPlan as Plan);
        tombs.delete(`plan:${id}`);
      }
    }
    const after = plans.get(id);
    const afterTomb = tombs.get(`plan:${id}`);
    const vAfter = after ? planVersion(after) : afterTomb ? tombVersion(afterTomb) : null;
    if (vAfter && versionKey(vAfter) === versionKey(vIn)) acked[planKey(id)] = versionKey(vIn);
  }

  // Relatives.
  for (const item of arr(body.relatives)) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0) continue;
    const id = item.id;
    const local = relatives.get(id);
    const tomb = tombs.get(`relative:${id}`);
    const incomingRel =
      item.deletedAt == null && isIsoTime(item.clientUpdatedAt) ? relativeFromWire(item, local?.history ?? [], item.clientUpdatedAt) : null;
    const vIn = wireVersion(item, incomingRel ? JSON.stringify(relativeFields(incomingRel)) : '');
    if (!vIn || (!vIn.deleted && !incomingRel)) continue;
    const vLocal = local ? relativeVersion(local) : tomb ? tombVersion(tomb) : null;
    if (vLocal === null || compareVersions(vLocal, vIn) < 0) {
      if (vIn.deleted) {
        relatives.delete(id);
        setTomb('relative', id, item.clientUpdatedAt as IsoTime);
      } else {
        relatives.set(id, incomingRel as Relative);
        tombs.delete(`relative:${id}`);
      }
    }
    const after = relatives.get(id);
    const afterTomb = tombs.get(`relative:${id}`);
    const vAfter = after ? relativeVersion(after) : afterTomb ? tombVersion(afterTomb) : null;
    if (vAfter && versionKey(vAfter) === versionKey(vIn)) acked[relativeKey(id)] = versionKey(vIn);
  }

  // Logs: max wins.
  for (const item of arr(body.logs)) {
    if (!isRecord(item) || typeof item.planId !== 'string' || !isValidDate(item.date)) continue;
    const amount = item.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) continue;
    const plan = plans.get(item.planId);
    if (!plan) {
      // A deleted plan keeps its logs in the tombstone (the server keeps them too).
      const tomb = tombs.get(`plan:${item.planId}`);
      if (tomb) {
        const log = { ...(tomb.log ?? {}) };
        log[item.date] = mergeLogAmount(log[item.date], amount);
        tombs.set(`plan:${item.planId}`, { ...tomb, log });
        if (log[item.date] === amount) acked[logKey(item.planId, item.date)] = String(amount);
      }
      continue;
    }
    const merged = mergeLogAmount(plan.log[item.date], amount);
    if (merged !== plan.log[item.date]) plans.set(plan.id, { ...plan, log: { ...plan.log, [item.date]: merged } });
    if (merged === amount) acked[logKey(plan.id, item.date)] = String(amount);
  }

  // Contacts: union with tombstones; an unpushed local change is the later write and stays.
  const view: Store = { ...store, sync: { ...store.sync, acked } };
  for (const item of arr(body.contacts)) {
    if (!isRecord(item) || typeof item.relativeId !== 'string' || !isValidDate(item.date) || typeof item.deleted !== 'boolean') continue;
    const rel = relatives.get(item.relativeId);
    if (!rel) continue;
    const key = contactKey(rel.id, item.date);
    const incoming = item.deleted ? 'deleted' : 'live';
    const local = localContactState(view, tombs, rel, item.date);
    if (local === incoming) {
      acked[key] = incoming;
      continue;
    }
    if (local !== null && local !== acked[key]) continue;
    const cid = `contact:${contactId(rel.id, item.date)}`;
    if (item.deleted) {
      if (rel.history.includes(item.date)) relatives.set(rel.id, { ...rel, history: rel.history.filter((d) => d !== item.date) });
    } else if (!rel.history.includes(item.date)) {
      relatives.set(rel.id, { ...rel, history: [...rel.history, item.date] });
    }
    tombs.delete(cid);
    acked[key] = incoming;
  }

  // A pushed contact removal that the server now holds needs no tombstone any more.
  for (const [k, t] of tombs) {
    if (t.kind === 'contact' && acked[`contact:${t.id}`] === 'deleted') tombs.delete(k);
  }

  const relList = [...relatives.values()].map((r) => {
    const last = latestDate(r.history);
    const out: Relative = { ...r };
    if (last === undefined) delete out.lastContactedOn;
    else out.lastContactedOn = last;
    return out;
  });

  // Forget acks of logs and contacts whose plan or relative is gone.
  for (const key of Object.keys(acked)) {
    if (key.startsWith('log:')) {
      const planId = key.slice(4, key.lastIndexOf('|'));
      if (!plans.has(planId) && !tombs.has(`plan:${planId}`)) delete acked[key];
    }
    if (key.startsWith('contact:') && !relatives.has(key.slice(8, key.lastIndexOf('|')))) delete acked[key];
  }

  return {
    ...store,
    plans: [...plans.values()],
    relatives: relList,
    settings,
    tombstones: [...tombs.values()],
    sync: { lastSyncedAt: serverTime, acked },
  };
}
