/**
 * «ترك المعصية»: a staged program for leaving a sin.
 *
 * LOCAL ONLY. Everything in a `SinProgram` (the sin slug, check-ins, free-text notes) stays on the device:
 * never send it to a server, never sync it, never back it up to our cloud, never put it in analytics or in a
 * notification/calendar title (roadmap §0.1–0.2). `exportForSync` in `storage.ts` drops programs for this reason.
 *
 * Owner decision (2026-10-28, roadmap §4.1): a gradual path is allowed only for a sin against the right of Allah
 * when leaving at once is very hard for the user. A sin against people's rights is always 'cut' (leave it, or
 * lighten it with strong effort) and adds a 'restore_rights' stage (رد الحقوق والاستحلال).
 *
 * Wording rule: no streaks, no counters of falls, no failure words. A fall leads to the «خربانة؟ صلّحها» content.
 *
 * Phase 3 (2026-10-31): a check-in after «ضعفت» / «وقعت ثم تبت» may carry optional triggers (when / where / feeling,
 * chips only), a «حسنة الآن» mark and one small limit for the next day. They live on the check-in, so they travel
 * only inside the encrypted vault with the rest of the program and merge with it by date. Stored programs from before
 * simply have none ({@link sanitizeCheckIn} drops anything unknown instead of losing the check-in).
 */
import { diffDays, isIsoTime, isValidDate, isoMillis, nowIso, toDayNumber, fromDayNumber, type IsoTime, type LocalDate } from './dates.js';

export type SinCategory = 'haqq_allah' | 'haqq_ibad';
export type Path = 'cut' | 'gradual';
export type Stage = 'harms' | 'alternatives' | 'environment' | 'limits' | 'restore_rights' | 'leave';
export type CheckInValue = 'held' | 'weak' | 'fell_repented';

/** «متى؟»: the part of the day. */
export type TriggerTime = 'fajr_morning' | 'dhuhr_asr' | 'maghrib_isha' | 'after_isha' | 'late_night';
/** «أين؟» */
export type TriggerPlace = 'alone' | 'with_someone' | 'outside';
/** «بماذا شعرت؟» */
export type TriggerFeeling = 'boredom' | 'tiredness' | 'anger' | 'loneliness' | 'stress' | 'sadness';

export const TRIGGER_TIMES: readonly TriggerTime[] = ['fajr_morning', 'dhuhr_asr', 'maghrib_isha', 'after_isha', 'late_night'];
export const TRIGGER_PLACES: readonly TriggerPlace[] = ['alone', 'with_someone', 'outside'];
export const TRIGGER_FEELINGS: readonly TriggerFeeling[] = ['boredom', 'tiredness', 'anger', 'loneliness', 'stress', 'sadness'];

/** Optional chips after «ضعفت» / «وقعت ثم تبت». Every part is optional; an empty object is not stored. */
export interface Triggers {
  when?: TriggerTime;
  where?: TriggerPlace;
  feeling?: TriggerFeeling;
}

/**
 * Generic small limits, chosen by trigger when the program has none that fits (the client translates the key).
 * A program's own practical steps are referred to as `action:<index>` (index into the catalog's `actions`).
 */
export const GENERIC_LIMITS = [
  'phone_outside_room',
  'stay_near_people',
  'plan_before_going_out',
  'leave_gathering_early',
  'plan_free_time',
  'sleep_early',
  'wudu_when_angry',
  'call_someone_daily',
  'walk_with_dhikr',
] as const;
export type GenericLimit = (typeof GENERIC_LIMITS)[number];
/** A generic limit key or `action:<n>`. */
export type LimitRef = GenericLimit | `action:${number}`;

export function isLimitRef(value: unknown): value is LimitRef {
  if (typeof value !== 'string') return false;
  if ((GENERIC_LIMITS as readonly string[]).includes(value)) return true;
  return /^action:(0|[1-9][0-9]?)$/.test(value);
}

export interface CheckIn {
  date: LocalDate;
  value: CheckInValue;
  /** Free text kept on the device only. */
  note?: string;
  /** Only with 'weak' or 'fell_repented'. */
  triggers?: Triggers;
  /** «أتبع السيئة الحسنة»: a good deed marked right after the fall (when no matching habit was logged instead). */
  goodDeed?: true;
  /** «حدّ صغير لغد»: shown on the next day's page. */
  nextLimit?: LimitRef;
  /** When this check-in was last written. Merging two devices keeps the later one ({@link mergePrograms}). */
  updatedAt?: IsoTime;
}

export interface SinProgram {
  sinSlug: string;
  category: SinCategory;
  path: Path;
  startedOn: LocalDate;
  /** One entry per date, ascending. */
  checkIns: CheckIn[];
  /** When the program was started or ended. */
  updatedAt?: IsoTime;
  /**
   * Set by {@link endProgram}: the program is over and its check-ins and notes are gone. It stays in the list as a
   * marker, so the copy in the vault or on another device does not bring it back ({@link mergePrograms}).
   */
  endedAt?: IsoTime;
}

const STAGES_ALLAH: readonly Stage[] = ['harms', 'alternatives', 'environment', 'limits', 'leave'];
const STAGES_IBAD: readonly Stage[] = ['harms', 'alternatives', 'environment', 'limits', 'restore_rights', 'leave'];
export const CHECK_IN_VALUES: readonly CheckInValue[] = ['held', 'weak', 'fell_repented'];
/** Minimum days in a stage. */
export const STAGE_MIN_DAYS = 7;
/** Check-ins needed in the stage's last 7 days to move on. */
export const STAGE_MIN_CHECKINS = 4;

/** The ordered stages for a category. */
export function stagesFor(category: SinCategory): readonly Stage[] {
  return category === 'haqq_ibad' ? STAGES_IBAD : STAGES_ALLAH;
}

/** 'gradual' only for haqq_allah when leaving at once is very hard; otherwise 'cut'. */
export function pathFor(category: SinCategory, hardToLeaveAtOnce: boolean): Path {
  return category === 'haqq_allah' && hardToLeaveAtOnce ? 'gradual' : 'cut';
}

export interface StartProgramInput {
  sinSlug: string;
  category: SinCategory;
  hardToLeaveAtOnce: boolean;
  startedOn: LocalDate;
}

export function startProgram(input: StartProgramInput, now: IsoTime = nowIso()): SinProgram {
  if (!input.sinSlug) throw new RangeError('sinSlug is required');
  if (input.category !== 'haqq_allah' && input.category !== 'haqq_ibad') throw new RangeError('Invalid category');
  if (!isValidDate(input.startedOn)) throw new RangeError('Invalid startedOn');
  return {
    sinSlug: input.sinSlug,
    category: input.category,
    path: pathFor(input.category, input.hardToLeaveAtOnce),
    startedOn: input.startedOn,
    checkIns: [],
    updatedAt: now,
  };
}

/** Ends one program: its check-ins and notes are dropped, and only an end marker is kept ({@link SinProgram.endedAt}). */
export function endProgram(program: SinProgram, now: IsoTime = nowIso()): SinProgram {
  return { sinSlug: program.sinSlug, category: program.category, path: program.path, startedOn: program.startedOn, checkIns: [], updatedAt: now, endedAt: now };
}

/** A program the user is following (not ended). */
export function isActiveProgram(program: SinProgram): boolean {
  return program.endedAt === undefined;
}

/** The programs the user is following, without end markers. */
export function activePrograms(programs: readonly SinProgram[]): SinProgram[] {
  return programs.filter(isActiveProgram);
}

const byDate = (a: CheckIn, b: CheckIn) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/**
 * Merges this device's programs with another copy (the vault), one program per sin; the same result on every device
 * that holds both copies. For a sin in both copies:
 * - an end wins over a copy last started before it, so an ended program does not come back; a program started
 *   again after the end wins over the end;
 * - otherwise check-ins are united by date, and on the same date the later written one wins (`updatedAt`, absent
 *   counts as the oldest; a tie keeps this device's), with its note. The program's own fields come from the copy
 *   started later (a tie keeps this device's).
 * The order is this device's, then programs only in the other copy.
 */
export function mergePrograms(local: readonly SinProgram[], remote: readonly SinProgram[]): SinProgram[] {
  const remoteBySlug = new Map(remote.map((p) => [p.sinSlug, p]));
  const merged = local.map((mine) => {
    const theirs = remoteBySlug.get(mine.sinSlug);
    return theirs ? mergeProgram(mine, theirs) : mine;
  });
  const localSlugs = new Set(local.map((p) => p.sinSlug));
  return [...merged, ...remote.filter((p) => !localSlugs.has(p.sinSlug))];
}

function mergeProgram(mine: SinProgram, theirs: SinProgram): SinProgram {
  const started = (p: SinProgram) => isoMillis(p.updatedAt);
  if (mine.endedAt !== undefined || theirs.endedAt !== undefined) {
    if (mine.endedAt !== undefined && theirs.endedAt !== undefined) return started(theirs) > started(mine) ? theirs : mine;
    const [ended, live] = mine.endedAt !== undefined ? [mine, theirs] : [theirs, mine];
    return started(live) > isoMillis(ended.endedAt) ? live : ended;
  }
  const dates = new Map<string, CheckIn>(mine.checkIns.map((c) => [c.date, c]));
  for (const c of theirs.checkIns) {
    const kept = dates.get(c.date);
    if (!kept || isoMillis(c.updatedAt) > isoMillis(kept.updatedAt)) dates.set(c.date, c);
  }
  const fields = started(theirs) > started(mine) ? theirs : mine;
  return { ...fields, checkIns: [...dates.values()].sort(byDate) };
}

/** Returns an English error message, or `null` when well-formed (including the haqq_ibad ⇒ cut rule). */
export function validateProgram(program: unknown): string | null {
  if (typeof program !== 'object' || program === null) return 'program must be an object';
  const p = program as Record<string, unknown>;
  if (typeof p.sinSlug !== 'string' || p.sinSlug.length === 0) return 'sinSlug must be a non-empty string';
  if (p.category !== 'haqq_allah' && p.category !== 'haqq_ibad') return 'category must be haqq_allah|haqq_ibad';
  if (p.path !== 'cut' && p.path !== 'gradual') return 'path must be cut|gradual';
  if (p.category === 'haqq_ibad' && p.path === 'gradual') return 'haqq_ibad programs cannot be gradual';
  if (!isValidDate(p.startedOn)) return 'startedOn must be YYYY-MM-DD';
  if (!Array.isArray(p.checkIns)) return 'checkIns must be an array';
  if (p.updatedAt !== undefined && !isIsoTime(p.updatedAt)) return 'updatedAt must be an ISO time';
  if (p.endedAt !== undefined && !isIsoTime(p.endedAt)) return 'endedAt must be an ISO time';
  for (const c of p.checkIns as unknown[]) {
    const e = validateCheckIn(c);
    if (e) return e;
  }
  return null;
}

/** Returns an English error message for one check-in, or `null`. */
export function validateCheckIn(c: unknown): string | null {
  if (typeof c !== 'object' || c === null) return 'check-in must be an object';
  const r = c as Record<string, unknown>;
  if (!isValidDate(r.date)) return 'check-in date must be YYYY-MM-DD';
  if (!CHECK_IN_VALUES.includes(r.value as CheckInValue)) return 'check-in value must be held|weak|fell_repented';
  if (r.note !== undefined && typeof r.note !== 'string') return 'check-in note must be a string';
  if (r.updatedAt !== undefined && !isIsoTime(r.updatedAt)) return 'check-in updatedAt must be an ISO time';
  if (r.triggers !== undefined) {
    const e = validateTriggers(r.triggers);
    if (e) return e;
    if (r.value === 'held') return 'triggers only follow weak|fell_repented';
  }
  if (r.goodDeed !== undefined && r.goodDeed !== true) return 'check-in goodDeed must be true when present';
  if (r.nextLimit !== undefined && !isLimitRef(r.nextLimit)) return 'check-in nextLimit must be a limit key or action:<n>';
  return null;
}

/** Returns an English error message for the trigger chips, or `null`. */
export function validateTriggers(t: unknown): string | null {
  if (typeof t !== 'object' || t === null || Array.isArray(t)) return 'triggers must be an object';
  const r = t as Record<string, unknown>;
  for (const key of Object.keys(r)) if (key !== 'when' && key !== 'where' && key !== 'feeling') return `unknown trigger ${key}`;
  if (r.when !== undefined && !TRIGGER_TIMES.includes(r.when as TriggerTime)) return 'trigger when is not known';
  if (r.where !== undefined && !TRIGGER_PLACES.includes(r.where as TriggerPlace)) return 'trigger where is not known';
  if (r.feeling !== undefined && !TRIGGER_FEELINGS.includes(r.feeling as TriggerFeeling)) return 'trigger feeling is not known';
  return null;
}

/** True when at least one chip is chosen. */
export function hasTriggers(t: Triggers | undefined): t is Triggers {
  return t !== undefined && (t.when !== undefined || t.where !== undefined || t.feeling !== undefined);
}

/**
 * Stored-data migration for one check-in: keeps the known, valid parts and drops the rest (an unknown chip, a
 * trigger on a 'held' day, a bad limit), so an older or damaged copy never loses the day itself. Missing = none.
 * Returns the input unchanged when it is not a check-in-shaped object (the validator then rejects it).
 */
export function sanitizeCheckIn(c: unknown): unknown {
  if (typeof c !== 'object' || c === null) return c;
  const r = { ...(c as Record<string, unknown>) };
  if (r.triggers !== undefined) {
    const t = r.triggers;
    const kept: Triggers = {};
    if (typeof t === 'object' && t !== null && r.value !== 'held') {
      const tr = t as Record<string, unknown>;
      if (TRIGGER_TIMES.includes(tr.when as TriggerTime)) kept.when = tr.when as TriggerTime;
      if (TRIGGER_PLACES.includes(tr.where as TriggerPlace)) kept.where = tr.where as TriggerPlace;
      if (TRIGGER_FEELINGS.includes(tr.feeling as TriggerFeeling)) kept.feeling = tr.feeling as TriggerFeeling;
    }
    if (hasTriggers(kept)) r.triggers = kept;
    else delete r.triggers;
  }
  if (r.goodDeed !== undefined && r.goodDeed !== true) delete r.goodDeed;
  if (r.nextLimit !== undefined && !isLimitRef(r.nextLimit)) delete r.nextLimit;
  return r;
}

/**
 * Records the day's check-in. One per date: a second check-in the same day replaces the value; its note
 * replaces the earlier note when given, otherwise the earlier note is kept.
 */
export function checkIn(
  program: SinProgram,
  date: LocalDate,
  value: CheckInValue,
  note?: string,
  now: IsoTime = nowIso(),
): SinProgram {
  if (!isValidDate(date)) throw new RangeError('Invalid date');
  if (!CHECK_IN_VALUES.includes(value)) throw new RangeError('Invalid check-in value');
  if (program.endedAt !== undefined) throw new RangeError('The program has ended');
  const previous = program.checkIns.find((c) => c.date === date);
  const entry: CheckIn = { date, value };
  const keptNote = note ?? previous?.note;
  if (keptNote !== undefined) entry.note = keptNote;
  // The chips describe a weak day or a fall: a day changed to «ثبتّ» drops them (and the limit that came with a fall).
  if (value !== 'held' && previous?.triggers) entry.triggers = { ...previous.triggers };
  if (value !== 'held' && previous?.nextLimit) entry.nextLimit = previous.nextLimit;
  if (previous?.goodDeed) entry.goodDeed = true;
  entry.updatedAt = now;
  const checkIns = program.checkIns.filter((c) => c.date !== date).concat(entry);
  checkIns.sort(byDate);
  return { ...program, checkIns };
}

/** What {@link annotateCheckIn} may change. `null` clears a part. */
export interface CheckInDetails {
  triggers?: Triggers | null;
  goodDeed?: boolean;
  nextLimit?: LimitRef | null;
}

/**
 * Adds or changes the optional details of the day's check-in (it must exist). Triggers are kept only on a weak day
 * or a fall; an empty set of chips clears them.
 */
export function annotateCheckIn(program: SinProgram, date: LocalDate, details: CheckInDetails, now: IsoTime = nowIso()): SinProgram {
  if (program.endedAt !== undefined) throw new RangeError('The program has ended');
  const previous = program.checkIns.find((c) => c.date === date);
  if (!previous) throw new RangeError('No check-in on this date');
  const entry: CheckIn = { ...previous };
  if (details.triggers !== undefined) {
    if (details.triggers === null || !hasTriggers(details.triggers)) delete entry.triggers;
    else {
      const e = validateTriggers(details.triggers);
      if (e) throw new RangeError(e);
      if (previous.value === 'held') throw new RangeError('Triggers only follow a weak day or a fall');
      const t: Triggers = {};
      if (details.triggers.when) t.when = details.triggers.when;
      if (details.triggers.where) t.where = details.triggers.where;
      if (details.triggers.feeling) t.feeling = details.triggers.feeling;
      entry.triggers = t;
    }
  }
  if (details.goodDeed !== undefined) {
    if (details.goodDeed) entry.goodDeed = true;
    else delete entry.goodDeed;
  }
  if (details.nextLimit !== undefined) {
    if (details.nextLimit === null) delete entry.nextLimit;
    else if (!isLimitRef(details.nextLimit)) throw new RangeError('Invalid limit');
    else entry.nextLimit = details.nextLimit;
  }
  entry.updatedAt = now;
  return { ...program, checkIns: program.checkIns.map((c) => (c.date === date ? entry : c)) };
}

export interface StageInfo {
  stage: Stage;
  /** 0-based position in {@link stagesFor}. */
  index: number;
  /** First day of the current stage. */
  since: LocalDate;
}

/**
 * The stage on `today`. A stage lasts at least 7 days; on any later day it advances when the 7 days before
 * that day hold ≥ 4 check-ins (any value counts: the program rewards showing up, not perfection). Otherwise
 * the user stays, with no penalty. The last stage ('leave') is kept.
 */
export function currentStage(program: SinProgram, today: LocalDate): StageInfo {
  const stages = stagesFor(program.category);
  const days = new Set(program.checkIns.map((c) => toDayNumber(c.date)));
  const end = toDayNumber(today);
  let index = 0;
  let start = toDayNumber(program.startedOn);
  let d = start + STAGE_MIN_DAYS;
  while (index < stages.length - 1 && d <= end) {
    let count = 0;
    for (let n = d - STAGE_MIN_DAYS; n < d; n++) if (days.has(n)) count++;
    if (count >= STAGE_MIN_CHECKINS) {
      index++;
      start = d;
      d = start + STAGE_MIN_DAYS;
    } else {
      d++;
    }
  }
  return { stage: stages[index] as Stage, index, since: fromDayNumber(start) };
}

export interface ProgramSummary {
  held: number;
  weak: number;
  fell_repented: number;
  /** Days with any check-in. */
  daysCheckedIn: number;
  /** Days in the range (inclusive). */
  days: number;
}

/** Counts per value between `from` and `to` (inclusive). Deliberately no streaks. */
export function summary(program: SinProgram, from: LocalDate, to: LocalDate): ProgramSummary {
  const out: ProgramSummary = { held: 0, weak: 0, fell_repented: 0, daysCheckedIn: 0, days: Math.max(0, diffDays(from, to) + 1) };
  for (const c of program.checkIns) {
    if (c.date >= from && c.date <= to) {
      out[c.value]++;
      out.daysCheckedIn++;
    }
  }
  return out;
}

/** The content key the app shows after «وقعت ثم تبت»: the «خربانة؟ صلّحها» guidance. */
export function afterFall(_program: SinProgram): 'fixit' {
  return 'fixit';
}

