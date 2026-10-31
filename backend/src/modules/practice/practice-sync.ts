import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  compareVersions,
  isValidDate,
  isValidTime,
  mergeLogEntry,
  planFields,
  relativeFields,
  validatePlan,
  validateRelative,
  validateRule,
  type LogEntry,
  type Plan,
  type Relative,
  type Rule,
  type Version,
} from '@thekra/practice-core';
import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Wire shapes, request parsing and row serialisation for the practice sync
 * (docs/plan/2026-10-practice-sync-contract.md §3). Pure apart from
 * `readPracticeChanges`, which only reads; PracticeSyncService writes.
 *
 * Validation goes through the practice-core validators (validatePlan,
 * validateRule, validateRelative / looksLikeContactDetails). Error details name
 * the list and the item index, never a value: these are personal notes.
 *
 * Values are stored exactly as sent (no trimming, no reordering, client times
 * kept as given): every replica orders versions with practice-core
 * `compareVersions` over the same canonical content (`planFields`,
 * `relativeFields`), so any server-side rewrite would make the server's copy
 * disagree with the device that sent it.
 */
export const MAX_SYNC_ITEMS = 500;
export const MAX_LIVE_PLANS = 50;
export const MAX_LIVE_RELATIVES = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_AMOUNT = 100_000;
const MAX_REMINDER_TIMES = 12;
const MAX_TITLE = 200;
const MAX_SLUG = 100;
const MAX_RELATION = 60;
const MAX_SLOTS = 12;

export interface SettingsWire {
  hijriOffset: number;
  reminderTimes: string[];
  freeMinutesPerDay: number | null;
  /** The device time of the edit (last-writer-wins key). */
  clientUpdatedAt: string;
  /** The server time of the last write. */
  updatedAt: string;
}

export interface SeasonWire {
  amount: number;
  until: string;
  previous: number;
}

/** A live plan. A deleted one travels as {@link DeletedWire}. */
export interface PlanWire {
  id: string;
  habitKey: string | null;
  deedSlug: string;
  title: string;
  unit: 'minutes' | 'count' | 'times';
  amount: number;
  ceiling: number | null;
  activeDaysPerWeek: number;
  slots: string[];
  rule: Rule | null;
  createdOn: string;
  amountChangedOn: string;
  ebbSince: string | null;
  season: SeasonWire | null;
  clientUpdatedAt: string;
  deletedAt: string | null;
}

/** A deleted plan or relative: only these three fields, in requests and in responses. */
export interface DeletedWire {
  id: string;
  clientUpdatedAt: string;
  deletedAt: string;
}

export interface LogWire {
  planId: string;
  date: string;
  /** Above 0, or 0 for a day cleared by a correction. */
  amount: number;
  /** Set when the day was corrected (undo, fixed amount). Absent from the wire when null. */
  correctedAt?: string | null;
}

export interface RelativeWire {
  id: string;
  name: string;
  relation: string;
  rule: Rule;
  lastContactedOn: string | null;
  clientUpdatedAt: string;
  deletedAt: string | null;
}

export interface ContactWire {
  relativeId: string;
  date: string;
  deleted: boolean;
}

export interface PracticeChangesDto {
  serverTime: string;
  settings: SettingsWire | null;
  plans: (PlanWire | DeletedWire)[];
  logs: LogWire[];
  relatives: (RelativeWire | DeletedWire)[];
  contacts: ContactWire[];
}

/** Settings as sent by a device. */
export type SettingsChange = Omit<SettingsWire, 'updatedAt'>;
/** A live plan carries every field; a tombstone may carry only id, clientUpdatedAt and deletedAt. */
export type PlanChange = { kind: 'live'; plan: PlanWire } | { kind: 'tombstone'; id: string; clientUpdatedAt: string; deletedAt: string };
export type RelativeChange =
  | { kind: 'live'; relative: RelativeWire }
  | { kind: 'tombstone'; id: string; clientUpdatedAt: string; deletedAt: string };

export interface SyncRequest {
  since: Date | null;
  settings: SettingsChange | null;
  plans: PlanChange[];
  logs: LogWire[];
  relatives: RelativeChange[];
  contacts: ContactWire[];
}

type Kind = 'settings' | 'plans' | 'logs' | 'relatives' | 'contacts' | 'request';

class ItemError extends Error {}

function invalid(kind: Kind, index: number | null, reason: string): BadRequestException {
  return new BadRequestException({
    code: 'PRACTICE_INVALID',
    message: `Invalid ${kind}${index === null ? '' : `[${index}]`}: ${reason}`,
    details: { kind, index, reason },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** A positive amount; partial amounts (e.g. 2.5 minutes) are allowed. */
function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT;
}

/**
 * True when any object in the JSON has a `programs` key. Sin-program data never
 * reaches the server in clear (contract §1): a client that sends it has a bug, so
 * the request is refused. Iterative, so a deeply nested body cannot overflow the stack.
 */
export function containsProgramsKey(value: unknown): boolean {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) pending.push(...current);
    else if (typeof current === 'object' && current !== null) {
      if (Object.hasOwn(current, 'programs')) return true;
      pending.push(...Object.values(current));
    }
  }
  return false;
}

/** An ISO 8601 UTC timestamp (`…Z`), normalised to milliseconds (`toISOString`). */
function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_UTC.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ItemError(`${field} must be an ISO 8601 UTC timestamp`);
  }
  return new Date(value).toISOString();
}

function optionalTimestamp(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : timestamp(value, field);
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ItemError(`${field} must be a UUID`);
  return value;
}

function date(value: unknown, field: string): string {
  if (!isValidDate(value)) throw new ItemError(`${field} must be YYYY-MM-DD`);
  return value;
}

function optionalDate(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : date(value, field);
}

function check(error: string | null): void {
  if (error) throw new ItemError(error);
}

function parseSettings(raw: unknown): SettingsChange {
  if (!isRecord(raw)) throw new ItemError('settings must be an object');
  const reminderTimes = raw['reminderTimes'] ?? [];
  if (!Array.isArray(reminderTimes) || reminderTimes.length > MAX_REMINDER_TIMES || !reminderTimes.every(isValidTime)) {
    throw new ItemError(`reminderTimes must be at most ${MAX_REMINDER_TIMES} HH:MM values`);
  }
  const hijriOffset = raw['hijriOffset'] ?? 0;
  if (!isInt(hijriOffset, -2, 2)) throw new ItemError('hijriOffset must be an integer −2…2');
  const freeMinutesPerDay = raw['freeMinutesPerDay'] ?? null;
  if (freeMinutesPerDay !== null && !isInt(freeMinutesPerDay, 0, 1440)) {
    throw new ItemError('freeMinutesPerDay must be null or an integer 0…1440');
  }
  return {
    hijriOffset,
    reminderTimes: [...reminderTimes],
    freeMinutesPerDay,
    clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt'),
  };
}

function parseSeason(raw: unknown): SeasonWire | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw) || !isAmount(raw['amount']) || !isAmount(raw['previous'])) {
    throw new ItemError('season must be {amount, until, previous} with positive amounts');
  }
  return { amount: raw['amount'], until: date(raw['until'], 'season.until'), previous: raw['previous'] };
}

function parsePlan(raw: unknown): PlanChange {
  if (!isRecord(raw)) throw new ItemError('plan must be an object');
  const id = uuid(raw['id'], 'id');
  const clientUpdatedAt = timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt');
  const deletedAt = optionalTimestamp(raw['deletedAt'], 'deletedAt');
  if (deletedAt) return { kind: 'tombstone', id, clientUpdatedAt, deletedAt };

  const ceiling = raw['ceiling'] ?? null;
  const season = parseSeason(raw['season']);
  const ebbSince = optionalDate(raw['ebbSince'], 'ebbSince');
  // The practice-core shape: `log` travels separately, `ebb`/`season`/`ceiling` are optional.
  check(
    validatePlan({
      id,
      deedSlug: raw['deedSlug'],
      title: raw['title'],
      unit: raw['unit'],
      amount: raw['amount'],
      ...(ceiling === null ? {} : { ceiling }),
      activeDaysPerWeek: raw['activeDaysPerWeek'],
      slots: raw['slots'],
      createdOn: raw['createdOn'],
      amountChangedOn: raw['amountChangedOn'],
      log: {},
      ...(ebbSince ? { ebb: { since: ebbSince } } : {}),
      ...(season ? { season } : {}),
    }),
  );
  const plan = raw as Record<string, unknown> & {
    deedSlug: string;
    title: string;
    unit: PlanWire['unit'];
    amount: number;
    activeDaysPerWeek: number;
    slots: string[];
    createdOn: string;
    amountChangedOn: string;
  };
  if (!isAmount(plan.amount)) throw new ItemError(`amount must be a number above 0 and at most ${MAX_AMOUNT}`);
  if (ceiling !== null && !isAmount(ceiling)) throw new ItemError(`ceiling must be null or a number above 0 and at most ${MAX_AMOUNT}`);
  if (plan.title.length > MAX_TITLE) throw new ItemError(`title must be at most ${MAX_TITLE} characters`);
  if (plan.deedSlug.length > MAX_SLUG || !SLUG.test(plan.deedSlug)) throw new ItemError('deedSlug must be a kebab-case slug');
  if (plan.slots.length > MAX_SLOTS) throw new ItemError(`slots must hold at most ${MAX_SLOTS} times`);
  const habitKey = raw['habitKey'] ?? null;
  if (habitKey !== null && (typeof habitKey !== 'string' || habitKey.length > MAX_SLUG || !SLUG.test(habitKey))) {
    throw new ItemError('habitKey must be null or a kebab-case key');
  }
  const rule = raw['rule'] ?? null;
  if (rule !== null) check(validateRule(rule));
  return {
    kind: 'live',
    plan: {
      id,
      habitKey,
      deedSlug: plan.deedSlug,
      title: plan.title,
      unit: plan.unit,
      amount: plan.amount,
      ceiling,
      activeDaysPerWeek: plan.activeDaysPerWeek,
      slots: [...plan.slots],
      rule: rule as Rule | null,
      createdOn: plan.createdOn,
      amountChangedOn: plan.amountChangedOn,
      ebbSince,
      season,
      clientUpdatedAt,
      deletedAt: null,
    },
  };
}

function parseRelative(raw: unknown): RelativeChange {
  if (!isRecord(raw)) throw new ItemError('relative must be an object');
  const id = uuid(raw['id'], 'id');
  const clientUpdatedAt = timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt');
  const deletedAt = optionalTimestamp(raw['deletedAt'], 'deletedAt');
  if (deletedAt) return { kind: 'tombstone', id, clientUpdatedAt, deletedAt };

  const lastContactedOn = optionalDate(raw['lastContactedOn'], 'lastContactedOn');
  // validateRelative also applies looksLikeContactDetails to name and relation; contacts travel separately.
  check(
    validateRelative({
      id,
      name: raw['name'],
      relation: raw['relation'],
      rule: raw['rule'],
      ...(lastContactedOn ? { lastContactedOn } : {}),
      history: [],
    }),
  );
  const relation = raw['relation'] as string;
  if (relation.length > MAX_RELATION) throw new ItemError(`relation must be at most ${MAX_RELATION} characters`);
  return {
    kind: 'live',
    relative: {
      id,
      name: raw['name'] as string,
      relation,
      rule: raw['rule'] as Rule,
      lastContactedOn,
      clientUpdatedAt,
      deletedAt: null,
    },
  };
}

/** A day's log. A corrected day (`correctedAt`) may be 0: the user undid «تمّ». */
function parseLog(raw: unknown): LogWire {
  if (!isRecord(raw)) throw new ItemError('log must be an object');
  const correctedAt = optionalTimestamp(raw['correctedAt'], 'correctedAt');
  const amount = raw['amount'];
  if (!isAmount(amount) && !(correctedAt !== null && amount === 0)) {
    throw new ItemError(`amount must be a number above 0 (0 only with correctedAt) and at most ${MAX_AMOUNT}`);
  }
  const log: LogWire = { planId: uuid(raw['planId'], 'planId'), date: date(raw['date'], 'date'), amount: amount as number };
  if (correctedAt !== null) log.correctedAt = correctedAt;
  return log;
}

function parseContact(raw: unknown): ContactWire {
  if (!isRecord(raw)) throw new ItemError('contact must be an object');
  const deleted = raw['deleted'] ?? false;
  if (typeof deleted !== 'boolean') throw new ItemError('deleted must be true or false');
  return { relativeId: uuid(raw['relativeId'], 'relativeId'), date: date(raw['date'], 'date'), deleted };
}

function list(changes: Record<string, unknown>, kind: Exclude<Kind, 'settings' | 'request'>): unknown[] {
  const value = changes[kind] ?? [];
  if (!Array.isArray(value)) throw invalid(kind, null, `${kind} must be an array`);
  return value;
}

function parseEach<T>(items: unknown[], kind: Kind, parse: (raw: unknown) => T): T[] {
  return items.map((raw, index) => {
    try {
      return parse(raw);
    } catch (error) {
      if (error instanceof ItemError) throw invalid(kind, index, error.message);
      throw error;
    }
  });
}

/** Last item wins for equal keys, except that `prefer` may keep the earlier one. */
/** Of two copies of one day's log in a request, the one practice-core `mergeLogEntry` keeps. */
function preferLog(kept: LogWire, next: LogWire): LogWire {
  const entry = (log: LogWire): LogEntry => (log.correctedAt ? { amount: log.amount, correctedAt: log.correctedAt } : { amount: log.amount });
  const a = entry(kept);
  return mergeLogEntry(a, entry(next)) === a ? kept : next;
}

function dedupe<T>(items: T[], key: (item: T) => string, prefer: (kept: T, next: T) => T = (_kept, next) => next): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const k = key(item);
    const kept = byKey.get(k);
    byKey.set(k, kept === undefined ? item : prefer(kept, item));
  }
  return [...byKey.values()];
}

// ── Versions (the same ordering as practice-core sync.ts) ────────────────────

/** The practice-core Plan behind a wire plan, so `planFields` gives the canonical content every replica uses. */
function corePlan(plan: PlanWire): Plan {
  return {
    id: plan.id,
    deedSlug: plan.deedSlug,
    title: plan.title,
    unit: plan.unit,
    amount: plan.amount,
    ...(plan.ceiling === null ? {} : { ceiling: plan.ceiling }),
    activeDaysPerWeek: plan.activeDaysPerWeek,
    slots: plan.slots,
    createdOn: plan.createdOn,
    amountChangedOn: plan.amountChangedOn,
    log: {},
    ...(plan.ebbSince ? { ebb: { since: plan.ebbSince } } : {}),
    ...(plan.season ? { season: plan.season } : {}),
    ...(plan.habitKey ? { habitKey: plan.habitKey } : {}),
    ...(plan.rule ? { rule: plan.rule } : {}),
  };
}

function coreRelative(relative: RelativeWire): Relative {
  return { id: relative.id, name: relative.name, relation: relative.relation, rule: relative.rule as Relative['rule'], history: [] };
}

const tombstoneVersion = (clientUpdatedAt: string): Version => ({ time: Date.parse(clientUpdatedAt), deleted: true, content: '' });

export function planVersion(change: PlanChange): Version {
  if (change.kind === 'tombstone') return tombstoneVersion(change.clientUpdatedAt);
  return { time: Date.parse(change.plan.clientUpdatedAt), deleted: false, content: JSON.stringify(planFields(corePlan(change.plan))) };
}

export function relativeVersion(change: RelativeChange): Version {
  if (change.kind === 'tombstone') return tombstoneVersion(change.clientUpdatedAt);
  return {
    time: Date.parse(change.relative.clientUpdatedAt),
    deleted: false,
    content: JSON.stringify(relativeFields(coreRelative(change.relative))),
  };
}

/** Settings content as practice-core builds it ({hijriOffset, reminderTimes, freeMinutesPerDay}). */
export function settingsVersion(settings: SettingsChange): Version {
  const { hijriOffset, reminderTimes, freeMinutesPerDay } = settings;
  return { time: Date.parse(settings.clientUpdatedAt), deleted: false, content: JSON.stringify({ hijriOffset, reminderTimes, freeMinutesPerDay }) };
}

/** True when `incoming` wins over `stored` (none stored: it wins). Equal versions do not win, so nothing is rewritten. */
export function wins(stored: Version | null, incoming: Version): boolean {
  return stored === null || compareVersions(stored, incoming) < 0;
}

const changeId = (change: PlanChange | RelativeChange) =>
  change.kind === 'live' ? ('plan' in change ? change.plan.id : change.relative.id) : change.id;

/**
 * Validates a POST /me/practice/sync body. Order: `programs` anywhere → 400
 * PRACTICE_PROGRAMS_NOT_ALLOWED; more than {@link MAX_SYNC_ITEMS} items → 413
 * PRACTICE_TOO_LARGE; any bad item → 400 PRACTICE_INVALID with its index.
 * Unknown fields are dropped. Duplicates inside one request are merged with the
 * same rules as against the database.
 */
export function parseSyncRequest(body: unknown): SyncRequest {
  if (containsProgramsKey(body)) {
    throw new BadRequestException({
      code: 'PRACTICE_PROGRAMS_NOT_ALLOWED',
      message: 'The sin program is synced only as the encrypted sin vault',
    });
  }
  if (!isRecord(body)) throw invalid('request', null, 'body must be an object');
  const sinceRaw = body['since'] ?? null;
  let since: Date | null = null;
  if (sinceRaw !== null) {
    if (typeof sinceRaw !== 'string' || Number.isNaN(Date.parse(sinceRaw)) || !ISO_UTC.test(sinceRaw)) {
      throw invalid('request', null, 'since must be null or an ISO 8601 UTC timestamp');
    }
    since = new Date(sinceRaw);
  }
  const changes = body['changes'] ?? {};
  if (!isRecord(changes)) throw invalid('request', null, 'changes must be an object');
  const raw = {
    plans: list(changes, 'plans'),
    logs: list(changes, 'logs'),
    relatives: list(changes, 'relatives'),
    contacts: list(changes, 'contacts'),
  };
  const settingsRaw = changes['settings'] ?? null;
  const total = raw.plans.length + raw.logs.length + raw.relatives.length + raw.contacts.length + (settingsRaw ? 1 : 0);
  if (total > MAX_SYNC_ITEMS) {
    throw new PayloadTooLargeException({
      code: 'PRACTICE_TOO_LARGE',
      message: `A sync request may carry at most ${MAX_SYNC_ITEMS} items; send the rest in another request`,
    });
  }
  const [settings] = settingsRaw === null ? [null] : parseEach([settingsRaw], 'settings', parseSettings);
  return {
    since,
    settings: settings ?? null,
    plans: dedupe(parseEach(raw.plans, 'plans', parsePlan), changeId, (kept, next) =>
      wins(planVersion(kept), planVersion(next)) ? next : kept,
    ),
    logs: dedupe(
      parseEach(raw.logs, 'logs', parseLog),
      (log) => `${log.planId}|${log.date}`,
      preferLog,
    ),
    relatives: dedupe(parseEach(raw.relatives, 'relatives', parseRelative), changeId, (kept, next) =>
      wins(relativeVersion(kept), relativeVersion(next)) ? next : kept,
    ),
    contacts: dedupe(parseEach(raw.contacts, 'contacts', parseContact), (contact) => `${contact.relativeId}|${contact.date}`),
  };
}

// ── Rows → wire ──────────────────────────────────────────────────────────────

const day = (value: Date) => value.toISOString().slice(0, 10);
const optionalDay = (value: Date | null) => (value ? day(value) : null);
const iso = (value: Date | null) => (value ? value.toISOString() : null);

type PlanRow = Prisma.HabitPlanGetPayload<object>;
type RelativeRow = Prisma.RelativeGetPayload<object>;

/** A row as the device sees it: a deleted one is only {id, clientUpdatedAt, deletedAt}. */
export function planRowToWire(row: PlanRow): PlanWire | DeletedWire {
  return row.deletedAt ? deletedToWire(row.id, row.clientUpdatedAt, row.deletedAt) : planToWire(row);
}

export function relativeRowToWire(row: RelativeRow): RelativeWire | DeletedWire {
  return row.deletedAt ? deletedToWire(row.id, row.clientUpdatedAt, row.deletedAt) : relativeToWire(row);
}

function deletedToWire(id: string, clientUpdatedAt: Date, deletedAt: Date): DeletedWire {
  return { id, clientUpdatedAt: clientUpdatedAt.toISOString(), deletedAt: deletedAt.toISOString() };
}

/** The live content of a row (its `deletedAt` is reported but the fields are the last ones stored). */
export function planToWire(row: PlanRow): PlanWire {
  return {
    id: row.id,
    habitKey: row.habitKey,
    deedSlug: row.deedSlug,
    title: row.title,
    unit: row.unit as PlanWire['unit'],
    amount: row.amount,
    ceiling: row.ceiling,
    activeDaysPerWeek: row.activeDaysPerWeek,
    slots: row.slots,
    rule: (row.rule ?? null) as Rule | null,
    createdOn: day(row.createdOn),
    amountChangedOn: day(row.amountChangedOn),
    ebbSince: optionalDay(row.ebbSince),
    season: (row.season ?? null) as SeasonWire | null,
    clientUpdatedAt: row.clientUpdatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}

export function relativeToWire(row: RelativeRow): RelativeWire {
  return {
    id: row.id,
    name: row.name,
    relation: row.relation,
    rule: row.rule as unknown as Rule,
    lastContactedOn: optionalDay(row.lastContactedOn),
    clientUpdatedAt: row.clientUpdatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
  };
}

/** Keys of the request, so items whose incoming copy lost the merge come back with the winning copy. */
export interface EchoKeys {
  settings: boolean;
  planIds: string[];
  logKeys: { planId: string; date: string }[];
  relativeIds: string[];
  contactKeys: { relativeId: string; date: string }[];
}

const NO_ECHO: EchoKeys = { settings: false, planIds: [], logKeys: [], relativeIds: [], contactKeys: [] };

/**
 * Everything of one user changed after `since` (all of it when null), plus the
 * items named in `echo`. Takes the client or a transaction; read-only.
 */
export async function readPracticeChanges(
  db: Pick<PrismaService, 'practiceSettings' | 'habitPlan' | 'habitLog' | 'relative' | 'relativeContact'>,
  userId: string,
  since: Date | null,
  serverTime: Date,
  echo: EchoKeys = NO_ECHO,
): Promise<PracticeChangesDto> {
  const changed = since ? { updatedAt: { gt: since } } : {};
  const orEcho = <T>(echoed: T[]) => (since ? { OR: [changed, ...echoed] } : {});
  const [settings, plans, logs, relatives, contacts] = await Promise.all([
    db.practiceSettings.findFirst({ where: { userId, ...(echo.settings ? {} : changed) } }),
    db.habitPlan.findMany({ where: { userId, ...orEcho(echo.planIds.length ? [{ id: { in: echo.planIds } }] : []) }, orderBy: { id: 'asc' } }),
    db.habitLog.findMany({
      where: { plan: { userId }, ...orEcho(echo.logKeys.map((key) => ({ planId: key.planId, date: new Date(key.date) }))) },
      orderBy: [{ planId: 'asc' }, { date: 'asc' }],
    }),
    db.relative.findMany({
      where: { userId, ...orEcho(echo.relativeIds.length ? [{ id: { in: echo.relativeIds } }] : []) },
      orderBy: { id: 'asc' },
    }),
    db.relativeContact.findMany({
      where: {
        relative: { userId },
        ...orEcho(echo.contactKeys.map((key) => ({ relativeId: key.relativeId, date: new Date(key.date) }))),
      },
      orderBy: [{ relativeId: 'asc' }, { date: 'asc' }],
    }),
  ]);
  return {
    serverTime: serverTime.toISOString(),
    settings: settings
      ? {
          hijriOffset: settings.hijriOffset,
          reminderTimes: settings.reminderTimes,
          freeMinutesPerDay: settings.freeMinutesPerDay,
          clientUpdatedAt: settings.clientUpdatedAt.toISOString(),
          updatedAt: settings.updatedAt.toISOString(),
        }
      : null,
    plans: plans.map(planRowToWire),
    logs: logs.map((log) => ({
      planId: log.planId,
      date: day(log.date),
      amount: log.amount,
      ...(log.correctedAt ? { correctedAt: log.correctedAt.toISOString() } : {}),
    })),
    relatives: relatives.map(relativeRowToWire),
    contacts: contacts.map((contact) => ({ relativeId: contact.relativeId, date: day(contact.date), deleted: contact.deletedAt !== null })),
  };
}
