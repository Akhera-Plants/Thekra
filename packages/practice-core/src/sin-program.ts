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
 */
import { diffDays, isValidDate, toDayNumber, fromDayNumber, type LocalDate } from './dates.js';

export type SinCategory = 'haqq_allah' | 'haqq_ibad';
export type Path = 'cut' | 'gradual';
export type Stage = 'harms' | 'alternatives' | 'environment' | 'limits' | 'restore_rights' | 'leave';
export type CheckInValue = 'held' | 'weak' | 'fell_repented';

export interface CheckIn {
  date: LocalDate;
  value: CheckInValue;
  /** Free text kept on the device only. */
  note?: string;
}

export interface SinProgram {
  sinSlug: string;
  category: SinCategory;
  path: Path;
  startedOn: LocalDate;
  /** One entry per date, ascending. */
  checkIns: CheckIn[];
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

export function startProgram(input: StartProgramInput): SinProgram {
  if (!input.sinSlug) throw new RangeError('sinSlug is required');
  if (input.category !== 'haqq_allah' && input.category !== 'haqq_ibad') throw new RangeError('Invalid category');
  if (!isValidDate(input.startedOn)) throw new RangeError('Invalid startedOn');
  return {
    sinSlug: input.sinSlug,
    category: input.category,
    path: pathFor(input.category, input.hardToLeaveAtOnce),
    startedOn: input.startedOn,
    checkIns: [],
  };
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
  return null;
}

/**
 * Records the day's check-in. One per date: a second check-in the same day replaces the value; its note
 * replaces the earlier note when given, otherwise the earlier note is kept.
 */
export function checkIn(program: SinProgram, date: LocalDate, value: CheckInValue, note?: string): SinProgram {
  if (!isValidDate(date)) throw new RangeError('Invalid date');
  if (!CHECK_IN_VALUES.includes(value)) throw new RangeError('Invalid check-in value');
  const previous = program.checkIns.find((c) => c.date === date);
  const entry: CheckIn = { date, value };
  const keptNote = note ?? previous?.note;
  if (keptNote !== undefined) entry.note = keptNote;
  const checkIns = program.checkIns.filter((c) => c.date !== date).concat(entry);
  checkIns.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { ...program, checkIns };
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

