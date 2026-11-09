import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ARCHIVE_MAX,
  cloneDayStates,
  cloneReflection,
  compareQadaLogs,
  compareReadMarks,
  compareReflections,
  isQadaKey,
  isQuoteId,
  isReciterKey,
  parseDayStates,
  parseQadaPlan,
  QADA_DAY_MAX,
  READS_MAX,
  REFLECTION_FIELDS,
  validateDayStates,
  validateQadaPlan,
  validateReflectionTexts,
  type DayStateEntry,
  type QadaKey,
  type QadaPlan,
  type Reflection,
  cloneHomeSections,
  compareFardMarks,
  compareVersions,
  isFardPrayer,
  isFardStatus,
  parseHomeSections,
  validateHomeSections,
  type FardPrayer,
  type FardStatus,
  type HomeSectionPref,
  MAX_EXCUSED_DAYS,
  PEOPLE_CIRCLES,
  settingsContent,
  cloneHabitLoop,
  isPrayerAnchor,
  isValidDate,
  isValidTime,
  mergeLogEntry,
  planFields,
  relativeFields,
  validatePlan,
  validateRelative,
  validateHabitLoops,
  validateRule,
  type HabitLoop,
  type LogEntry,
  type PeopleCircle,
  type PrayerAnchor,
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
/** Round 6: archived (paused) plans at most; practice-core `ARCHIVE_MAX`. */
export const MAX_ARCHIVED_PLANS = ARCHIVE_MAX;
/** Round 6: read marks kept per user (the oldest are dropped beyond it); practice-core `READS_MAX`. */
export const MAX_READ_MARKS = READS_MAX;

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
  /** «عذر» days, ascending and unique (an older client omits it: none). */
  excusedDays: string[];
  /** «خصّص الرئيسية» (round 5): the member's home order; null = the defaults (an older client omits it). */
  homeSections: HomeSectionPref[] | null;
  /** «الفرائض» switch (round 5); an older client omits it: off. */
  fardTracking: boolean;
  /** Round 6 «حال يومي» (null = none), «قضاء الفوائت» plan (null = none), «تخفّف» covering (default on), reciter (null = default). An older client omits them. */
  dayStates: DayStateEntry[] | null;
  qada: QadaPlan | null;
  lightenCovered: boolean;
  reciter: string | null;
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
  /** Phase 2 (2026-10-31). An older client omits them: null. */
  pausedOn: string | null;
  resumedOn: string | null;
  establishedOn: string | null;
  /** Phase 6 prayer anchors, one per slot (`null` = fixed time); null when none. An older client omits it. */
  slotAnchors: (PrayerAnchor | null)[] | null;
  /** «حلقة العادة» (2026-11-01): practice-core HabitLoop[], null when none. An older client omits it. */
  loops: HabitLoop[] | null;
  /** Round 6: «القدر الأدنى», the start amount and the restart day; null when not set. An older client omits them. */
  minimum: number | null;
  startAmount: number | null;
  restartedOn: string | null;
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
  /** The people list; an older client omits it: `kin`. */
  circle: PeopleCircle;
  lastContactedOn: string | null;
  clientUpdatedAt: string;
  deletedAt: string | null;
}

export interface ContactWire {
  relativeId: string;
  date: string;
  deleted: boolean;
}

/** One «الفرائض» mark (round 5): `status` null is a cleared mark. Last writer wins by `clientUpdatedAt`. */
export interface FardWire {
  date: string;
  prayer: FardPrayer;
  status: FardStatus | null;
  clientUpdatedAt: string;
}

/** A habit reflection (round 6). All answers null = a cleared reflection. Last writer wins per (plan, date). */
export interface ReflectionWire {
  planId: string;
  date: string;
  helped: string | null;
  hard: string | null;
  note: string | null;
  clientUpdatedAt: string;
}

/** «قضاء الفوائت» made up on one day for one key (round 6); 0 clears it. Last writer wins per (date, prayer). */
export interface QadaLogWire {
  date: string;
  prayer: QadaKey;
  count: number;
  clientUpdatedAt: string;
}

/** A read mark of a text (round 6). Last writer wins per quote. */
export interface ReadWire {
  quoteId: string;
  read: boolean;
  clientUpdatedAt: string;
}

export interface PracticeChangesDto {
  serverTime: string;
  settings: SettingsWire | null;
  plans: (PlanWire | DeletedWire)[];
  logs: LogWire[];
  relatives: (RelativeWire | DeletedWire)[];
  contacts: ContactWire[];
  fard: FardWire[];
  reflections: ReflectionWire[];
  qadaLogs: QadaLogWire[];
  reads: ReadWire[];
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
  fard: FardWire[];
  reflections: ReflectionWire[];
  qadaLogs: QadaLogWire[];
  reads: ReadWire[];
}

type Kind = 'settings' | 'plans' | 'logs' | 'relatives' | 'contacts' | 'fard' | 'reflections' | 'qadaLogs' | 'reads' | 'request';

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
  const excusedDays = raw['excusedDays'] ?? [];
  if (
    !Array.isArray(excusedDays) ||
    excusedDays.length > MAX_EXCUSED_DAYS ||
    !excusedDays.every(isValidDate) ||
    excusedDays.some((day, index) => index > 0 && day <= excusedDays[index - 1])
  ) {
    throw new ItemError(`excusedDays must be at most ${MAX_EXCUSED_DAYS} YYYY-MM-DD dates, ascending and unique`);
  }
  const rawHome = raw['homeSections'] ?? null;
  if (rawHome !== null) check(validateHomeSections(rawHome));
  const fardTracking = raw['fardTracking'] ?? false;
  if (typeof fardTracking !== 'boolean') throw new ItemError('fardTracking must be true or false');
  const rawStates = raw['dayStates'] ?? null;
  if (rawStates !== null) check(validateDayStates(rawStates));
  const rawQada = raw['qada'] ?? null;
  if (rawQada !== null) check(validateQadaPlan(rawQada));
  const lightenCovered = raw['lightenCovered'] ?? true;
  if (typeof lightenCovered !== 'boolean') throw new ItemError('lightenCovered must be true or false');
  const reciter = raw['reciter'] ?? null;
  if (reciter !== null && !isReciterKey(reciter)) throw new ItemError('reciter must be null or a known reciter key');
  const dayStates = rawStates === null ? [] : parseDayStates(rawStates);
  return {
    hijriOffset,
    reminderTimes: [...reminderTimes],
    freeMinutesPerDay,
    excusedDays: [...(excusedDays as string[])],
    // Known fields only, in the canonical order.
    homeSections: rawHome === null ? null : cloneHomeSections(rawHome as HomeSectionPref[]),
    fardTracking,
    dayStates: dayStates.length > 0 ? cloneDayStates(dayStates) : null,
    qada: rawQada === null ? null : parseQadaPlan(rawQada),
    lightenCovered,
    reciter: reciter as string | null,
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
  const pausedOn = optionalDate(raw['pausedOn'], 'pausedOn');
  const resumedOn = optionalDate(raw['resumedOn'], 'resumedOn');
  const establishedOn = optionalDate(raw['establishedOn'], 'establishedOn');
  const rawAnchors = raw['slotAnchors'] ?? null;
  const slotAnchors = Array.isArray(rawAnchors) && rawAnchors.some((a) => a !== null) ? (rawAnchors as (PrayerAnchor | null)[]) : null;
  if (rawAnchors !== null && !Array.isArray(rawAnchors)) throw new ItemError('slotAnchors must be null or an array');
  const rawLoops = raw['loops'] ?? null;
  if (rawLoops !== null) check(validateHabitLoops(rawLoops));
  // Known fields only, in the canonical order (unknown loop fields are dropped like any unknown field).
  const loops = Array.isArray(rawLoops) && rawLoops.length > 0 ? (rawLoops as HabitLoop[]).map(cloneHabitLoop) : null;
  const minimum = raw['minimum'] ?? null;
  if (minimum !== null && !isAmount(minimum)) throw new ItemError(`minimum must be null or a number above 0 and at most ${MAX_AMOUNT}`);
  const startAmount = raw['startAmount'] ?? null;
  if (startAmount !== null && !isAmount(startAmount)) throw new ItemError(`startAmount must be null or a number above 0 and at most ${MAX_AMOUNT}`);
  const restartedOn = optionalDate(raw['restartedOn'], 'restartedOn');
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
      ...(pausedOn ? { pausedOn } : {}),
      ...(resumedOn ? { resumedOn } : {}),
      ...(establishedOn ? { establishedOn } : {}),
      ...(slotAnchors ? { slotAnchors } : {}),
      ...(loops ? { loops } : {}),
      ...(minimum !== null ? { minimum } : {}),
      ...(startAmount !== null ? { startAmount } : {}),
      ...(restartedOn ? { restartedOn } : {}),
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
      pausedOn,
      resumedOn,
      establishedOn,
      slotAnchors: slotAnchors ? [...slotAnchors] : null,
      loops,
      minimum: minimum as number | null,
      startAmount: startAmount as number | null,
      restartedOn,
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
  const circle = raw['circle'] ?? 'kin';
  if (!PEOPLE_CIRCLES.includes(circle as PeopleCircle)) throw new ItemError(`circle must be one of ${PEOPLE_CIRCLES.join(', ')}`);
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
      circle: circle as PeopleCircle,
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

/**
 * A «الفرائض» mark. The day may not be later than tomorrow in UTC (a device east of UTC is already a day ahead);
 * a mark is never set for a day that has not come.
 */
function parseFard(raw: unknown, latestDay: string): FardWire {
  if (!isRecord(raw)) throw new ItemError('fard must be an object');
  const day = date(raw['date'], 'date');
  if (day > latestDay) throw new ItemError('date must not be in the future');
  if (!isFardPrayer(raw['prayer'])) throw new ItemError('prayer must be one of fajr, dhuhr, asr, maghrib, isha');
  const status = raw['status'] ?? null;
  if (status !== null && !isFardStatus(status)) throw new ItemError('status must be onTime, qada or null');
  return { date: day, prayer: raw['prayer'], status, clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt') };
}

/** A habit reflection (round 6). The day may not be later than tomorrow in UTC. Answers ≤ 300 characters, stored as sent. */
function parseReflection(raw: unknown, latestDay: string): ReflectionWire {
  if (!isRecord(raw)) throw new ItemError('reflection must be an object');
  const day = date(raw['date'], 'date');
  if (day > latestDay) throw new ItemError('date must not be in the future');
  check(validateReflectionTexts(raw));
  const text = (k: (typeof REFLECTION_FIELDS)[number]) => {
    const v = raw[k];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  return {
    planId: uuid(raw['planId'], 'planId'),
    date: day,
    helped: text('helped'),
    hard: text('hard'),
    note: text('note'),
    clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt'),
  };
}

/** One «قضاء الفوائت» day count (round 6). The day may not be later than tomorrow in UTC. */
function parseQadaLog(raw: unknown, latestDay: string): QadaLogWire {
  if (!isRecord(raw)) throw new ItemError('qadaLog must be an object');
  const day = date(raw['date'], 'date');
  if (day > latestDay) throw new ItemError('date must not be in the future');
  if (!isQadaKey(raw['prayer'])) throw new ItemError('prayer must be one of fajr, dhuhr, asr, maghrib, isha, any');
  if (!isInt(raw['count'], 0, QADA_DAY_MAX)) throw new ItemError(`count must be an integer 0…${QADA_DAY_MAX}`);
  return { date: day, prayer: raw['prayer'], count: raw['count'], clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt') };
}

/** One read mark (round 6): a Quote id (UUID, stored lower-case) and true/false. */
function parseRead(raw: unknown): ReadWire {
  if (!isRecord(raw)) throw new ItemError('read must be an object');
  if (!isQuoteId(raw['quoteId'])) throw new ItemError('quoteId must be a UUID');
  if (typeof raw['read'] !== 'boolean') throw new ItemError('read must be true or false');
  return { quoteId: raw['quoteId'].toLowerCase(), read: raw['read'], clientUpdatedAt: timestamp(raw['clientUpdatedAt'], 'clientUpdatedAt') };
}

/** practice-core `Reflection` of a wire reflection (for `compareReflections`). */
export function coreReflection(r: Pick<ReflectionWire, 'planId' | 'date' | 'helped' | 'hard' | 'note' | 'clientUpdatedAt'>): Reflection {
  return cloneReflection({
    planId: r.planId,
    date: r.date,
    ...(r.helped ? { helped: r.helped } : {}),
    ...(r.hard ? { hard: r.hard } : {}),
    ...(r.note ? { note: r.note } : {}),
    updatedAt: r.clientUpdatedAt,
  });
}

/** Of two copies of one reflection, true when `incoming` wins (practice-core `compareReflections`). */
export function reflectionWins(stored: ReflectionWire | null, incoming: ReflectionWire): boolean {
  return stored === null || compareReflections(coreReflection(stored), coreReflection(incoming)) < 0;
}

/** Of two copies of one «قضاء» day count, true when `incoming` wins (practice-core `compareQadaLogs`). */
export function qadaLogWins(stored: Pick<QadaLogWire, 'count' | 'clientUpdatedAt'> | null, incoming: Pick<QadaLogWire, 'count' | 'clientUpdatedAt'>): boolean {
  return stored === null || compareQadaLogs({ count: stored.count, updatedAt: stored.clientUpdatedAt }, { count: incoming.count, updatedAt: incoming.clientUpdatedAt }) < 0;
}

/** Of two copies of one read mark, true when `incoming` wins (practice-core `compareReadMarks`). */
export function readWins(stored: Pick<ReadWire, 'read' | 'clientUpdatedAt'> | null, incoming: Pick<ReadWire, 'read' | 'clientUpdatedAt'>): boolean {
  return stored === null || compareReadMarks({ read: stored.read, updatedAt: stored.clientUpdatedAt }, { read: incoming.read, updatedAt: incoming.clientUpdatedAt }) < 0;
}

/** Of two copies of one mark, the one practice-core `compareFardMarks` keeps (later time; then a cleared mark). */
export function fardWins(stored: Pick<FardWire, 'status' | 'clientUpdatedAt'> | null, incoming: Pick<FardWire, 'status' | 'clientUpdatedAt'>): boolean {
  if (stored === null) return true;
  return compareFardMarks({ status: stored.status, updatedAt: stored.clientUpdatedAt }, { status: incoming.status, updatedAt: incoming.clientUpdatedAt }) < 0;
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
    ...(plan.pausedOn ? { pausedOn: plan.pausedOn } : {}),
    ...(plan.resumedOn ? { resumedOn: plan.resumedOn } : {}),
    ...(plan.establishedOn ? { establishedOn: plan.establishedOn } : {}),
    ...(plan.slotAnchors ? { slotAnchors: plan.slotAnchors } : {}),
    ...(plan.loops ? { loops: plan.loops } : {}),
    ...(plan.minimum !== null ? { minimum: plan.minimum } : {}),
    ...(plan.startAmount !== null ? { startAmount: plan.startAmount } : {}),
    ...(plan.restartedOn ? { restartedOn: plan.restartedOn } : {}),
  };
}

function coreRelative(relative: RelativeWire): Relative {
  return {
    id: relative.id,
    name: relative.name,
    relation: relative.relation,
    rule: relative.rule as Relative['rule'],
    ...(relative.circle !== 'kin' ? { circle: relative.circle } : {}),
    history: [],
  };
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

/**
 * Settings content as practice-core builds it (`settingsContent`: excusedDays only when not empty, homeSections only
 * when set, fardTracking only when on).
 */
export function settingsVersion(
  settings: Omit<SettingsChange, 'homeSections' | 'fardTracking' | 'dayStates' | 'qada' | 'lightenCovered' | 'reciter'> &
    Partial<Pick<SettingsChange, 'homeSections' | 'fardTracking' | 'dayStates' | 'qada' | 'lightenCovered' | 'reciter'>>,
): Version {
  return { time: Date.parse(settings.clientUpdatedAt), deleted: false, content: settingsContent(settings) };
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
export function parseSyncRequest(body: unknown, now: Date = new Date()): SyncRequest {
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
    fard: list(changes, 'fard'),
    reflections: list(changes, 'reflections'),
    qadaLogs: list(changes, 'qadaLogs'),
    reads: list(changes, 'reads'),
  };
  const settingsRaw = changes['settings'] ?? null;
  const total =
    raw.plans.length +
    raw.logs.length +
    raw.relatives.length +
    raw.contacts.length +
    raw.fard.length +
    raw.reflections.length +
    raw.qadaLogs.length +
    raw.reads.length +
    (settingsRaw ? 1 : 0);
  if (total > MAX_SYNC_ITEMS) {
    throw new PayloadTooLargeException({
      code: 'PRACTICE_TOO_LARGE',
      message: `A sync request may carry at most ${MAX_SYNC_ITEMS} items; send the rest in another request`,
    });
  }
  const [settings] = settingsRaw === null ? [null] : parseEach([settingsRaw], 'settings', parseSettings);
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
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
    fard: dedupe(
      parseEach(raw.fard, 'fard', (item) => parseFard(item, new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10))),
      (mark) => `${mark.date}|${mark.prayer}`,
      (kept, next) => (fardWins(kept, next) ? next : kept),
    ),
    reflections: dedupe(
      parseEach(raw.reflections, 'reflections', (item) => parseReflection(item, tomorrow)),
      (r) => `${r.planId}|${r.date}`,
      (kept, next) => (reflectionWins(kept, next) ? next : kept),
    ),
    qadaLogs: dedupe(
      parseEach(raw.qadaLogs, 'qadaLogs', (item) => parseQadaLog(item, tomorrow)),
      (l) => `${l.date}|${l.prayer}`,
      (kept, next) => (qadaLogWins(kept, next) ? next : kept),
    ),
    reads: dedupe(
      parseEach(raw.reads, 'reads', parseRead),
      (m) => m.quoteId,
      (kept, next) => (readWins(kept, next) ? next : kept),
    ),
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
    pausedOn: optionalDay(row.pausedOn),
    resumedOn: optionalDay(row.resumedOn),
    establishedOn: optionalDay(row.establishedOn),
    slotAnchors: anchorsOf(row.slotAnchors),
    loops: loopsOf(row.loops),
    minimum: row.minimum,
    startAmount: row.startAmount,
    restartedOn: optionalDay(row.restartedOn),
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
    circle: (PEOPLE_CIRCLES.includes(row.circle as PeopleCircle) ? row.circle : 'kin') as PeopleCircle,
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
  /** «الفرائض» marks of the request (absent: none). */
  fardKeys?: { date: string; prayer: string }[];
  /** Round 6 items of the request (absent: none). */
  reflectionKeys?: { planId: string; date: string }[];
  qadaKeys?: { date: string; prayer: string }[];
  readIds?: string[];
}

const NO_ECHO: EchoKeys = { settings: false, planIds: [], logKeys: [], relativeIds: [], contactKeys: [], fardKeys: [] };

/**
 * Everything of one user changed after `since` (all of it when null), plus the
 * items named in `echo`. Takes the client or a transaction; read-only.
 */
export async function readPracticeChanges(
  db: Pick<
    PrismaService,
    'practiceSettings' | 'habitPlan' | 'habitLog' | 'relative' | 'relativeContact' | 'fardMark' | 'habitReflection' | 'qadaLog' | 'quoteRead'
  >,
  userId: string,
  since: Date | null,
  serverTime: Date,
  echo: EchoKeys = NO_ECHO,
): Promise<PracticeChangesDto> {
  const changed = since ? { updatedAt: { gt: since } } : {};
  const orEcho = <T>(echoed: T[]) => (since ? { OR: [changed, ...echoed] } : {});
  const fardKeys = echo.fardKeys ?? [];
  const reflectionKeys = echo.reflectionKeys ?? [];
  const qadaKeys = echo.qadaKeys ?? [];
  const readIds = echo.readIds ?? [];
  const [settings, plans, logs, relatives, contacts, fard, reflections, qadaLogs, reads] = await Promise.all([
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
    db.fardMark.findMany({
      where: { userId, ...orEcho(fardKeys.map((key) => ({ date: new Date(key.date), prayer: key.prayer }))) },
      orderBy: [{ date: 'asc' }, { prayer: 'asc' }],
    }),
    db.habitReflection.findMany({
      where: { plan: { userId }, ...orEcho(reflectionKeys.map((key) => ({ planId: key.planId, date: new Date(key.date) }))) },
      orderBy: [{ date: 'asc' }, { planId: 'asc' }],
    }),
    db.qadaLog.findMany({
      where: { userId, ...orEcho(qadaKeys.map((key) => ({ date: new Date(key.date), prayer: key.prayer }))) },
      orderBy: [{ date: 'asc' }, { prayer: 'asc' }],
    }),
    db.quoteRead.findMany({
      where: { userId, ...orEcho(readIds.length ? [{ quoteId: { in: readIds } }] : []) },
      orderBy: [{ clientUpdatedAt: 'asc' }, { quoteId: 'asc' }],
    }),
  ]);
  return {
    serverTime: serverTime.toISOString(),
    settings: settings
      ? {
          hijriOffset: settings.hijriOffset,
          reminderTimes: settings.reminderTimes,
          freeMinutesPerDay: settings.freeMinutesPerDay,
          excusedDays: settings.excusedDays,
          homeSections: homeSectionsOf(settings.homeSections),
          fardTracking: settings.fardTracking,
          dayStates: dayStatesOf(settings.dayStates),
          qada: settings.qada === null ? null : parseQadaPlan(settings.qada),
          lightenCovered: settings.lightenCovered,
          reciter: isReciterKey(settings.reciter) ? settings.reciter : null,
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
    fard: fard.flatMap((mark) =>
      isFardPrayer(mark.prayer) && (mark.status === null || isFardStatus(mark.status))
        ? [{ date: day(mark.date), prayer: mark.prayer, status: mark.status, clientUpdatedAt: mark.clientUpdatedAt.toISOString() }]
        : [],
    ),
    reflections: reflections.map((r) => ({
      planId: r.planId,
      date: day(r.date),
      helped: r.helped,
      hard: r.hard,
      note: r.note,
      clientUpdatedAt: r.clientUpdatedAt.toISOString(),
    })),
    qadaLogs: qadaLogs.flatMap((l) =>
      isQadaKey(l.prayer) ? [{ date: day(l.date), prayer: l.prayer, count: l.count, clientUpdatedAt: l.clientUpdatedAt.toISOString() }] : [],
    ),
    reads: reads.map((m) => ({ quoteId: m.quoteId, read: m.read, clientUpdatedAt: m.clientUpdatedAt.toISOString() })),
  };
}

/** A stored `dayStates` value in the canonical field order; null for none or bad data. */
export function dayStatesOf(value: unknown): DayStateEntry[] | null {
  if (value === null || value === undefined || validateDayStates(value) !== null) return null;
  const list = parseDayStates(value);
  return list.length > 0 ? cloneDayStates(list) : null;
}

/**
 * A stored `homeSections` value in the canonical field order (jsonb reorders object keys), exactly as the device sent
 * it (no sections added); null for none or bad data.
 */
export function homeSectionsOf(value: unknown): HomeSectionPref[] | null {
  if (value === null || value === undefined || validateHomeSections(value) !== null) return null;
  return parseHomeSections(value);
}

/** A stored `slotAnchors` value: an array with at least one anchor, else null (old rows, bad data). */
function anchorsOf(value: unknown): (PrayerAnchor | null)[] | null {
  if (!Array.isArray(value) || !value.every((a) => a === null || isPrayerAnchor(a)) || !value.some((a) => a !== null)) return null;
  return value as (PrayerAnchor | null)[];
}

/**
 * A stored `loops` value: valid habit loops in the canonical field order (jsonb reorders object keys), else null
 * (old rows, none, bad data).
 */
function loopsOf(value: unknown): HabitLoop[] | null {
  if (!Array.isArray(value) || value.length === 0 || validateHabitLoops(value) !== null) return null;
  return (value as HabitLoop[]).map(cloneHabitLoop);
}
