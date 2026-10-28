/**
 * Recurrence rules and their expansion into local dates.
 *
 * Weekdays are 0 = Sunday … 6 = Saturday. Hijri rules use Umm al-Qura plus the user's `hijriOffset`
 * (see `hijri.ts`). Expansion is day by day, so every rule kind behaves the same way at month and year edges.
 */
import { addDays, diffDays, isValidDate, toDayNumber, fromDayNumber, weekday, type LocalDate } from './dates.js';
import { assertHijriOffset, toHijri } from './hijri.js';

export type Rule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] }
  /** Every `n` days starting on `anchor` (no occurrence before `anchor`). */
  | { kind: 'everyNDays'; n: number; anchor: LocalDate }
  /** Every `n` weeks on `weekday`; the first occurrence is the first such weekday on or after `anchor`. */
  | { kind: 'everyNWeeks'; n: number; weekday: number; anchor: LocalDate }
  /** A Gregorian day of the month, 1–28 so that it exists in every month. */
  | { kind: 'monthlyDay'; day: number }
  /** Hijri days of every month, e.g. 13, 14, 15 (الأيام البيض). Day 30 only fires in 30-day months. */
  | { kind: 'hijriMonthDays'; days: number[] }
  /** One Hijri date every year, e.g. 9 Dhu al-Hijja (عرفة) or 10 Muharram (عاشوراء). */
  | { kind: 'hijriYearly'; month: number; day: number }
  /** A window inside one Hijri month, e.g. Shawwal 2–30 (ست من شوال). */
  | { kind: 'hijriWindow'; month: number; fromDay: number; toDay: number };

export type RuleKind = Rule['kind'];

export interface RuleOptions {
  /** User Hijri offset, −2…+2 (default 0). Only Hijri rules read it. */
  hijriOffset?: number;
}

export const MAX_EVERY_N_DAYS = 3650;
export const MAX_EVERY_N_WEEKS = 520;
/** Longest span `occurrences` will expand in one call (about 10 years). */
export const MAX_RANGE_DAYS = 3700;
/** How far `nextOccurrences` searches before giving up (about 100 years). */
const MAX_SEARCH_DAYS = 36_600;

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const inRange = (v: unknown, lo: number, hi: number): v is number => isInt(v) && v >= lo && v <= hi;

function validIntList(v: unknown, lo: number, hi: number): string | null {
  if (!Array.isArray(v) || v.length === 0) return 'must be a non-empty array';
  if (!v.every((x) => inRange(x, lo, hi))) return `values must be integers ${lo}–${hi}`;
  if (new Set(v).size !== v.length) return 'values must be unique';
  return null;
}

/** Returns an English error message, or `null` when the rule is valid. Accepts any input (e.g. parsed JSON). */
export function validateRule(rule: unknown): string | null {
  if (typeof rule !== 'object' || rule === null) return 'rule must be an object';
  const r = rule as Record<string, unknown>;
  switch (r.kind) {
    case 'daily':
      return null;
    case 'weekdays': {
      const e = validIntList(r.days, 0, 6);
      return e ? `weekdays.days ${e}` : null;
    }
    case 'everyNDays':
      if (!inRange(r.n, 1, MAX_EVERY_N_DAYS)) return `everyNDays.n must be an integer 1–${MAX_EVERY_N_DAYS}`;
      if (!isValidDate(r.anchor)) return 'everyNDays.anchor must be YYYY-MM-DD';
      return null;
    case 'everyNWeeks':
      if (!inRange(r.n, 1, MAX_EVERY_N_WEEKS)) return `everyNWeeks.n must be an integer 1–${MAX_EVERY_N_WEEKS}`;
      if (!inRange(r.weekday, 0, 6)) return 'everyNWeeks.weekday must be an integer 0–6';
      if (!isValidDate(r.anchor)) return 'everyNWeeks.anchor must be YYYY-MM-DD';
      return null;
    case 'monthlyDay':
      return inRange(r.day, 1, 28) ? null : 'monthlyDay.day must be an integer 1–28';
    case 'hijriMonthDays': {
      const e = validIntList(r.days, 1, 30);
      return e ? `hijriMonthDays.days ${e}` : null;
    }
    case 'hijriYearly':
      if (!inRange(r.month, 1, 12)) return 'hijriYearly.month must be an integer 1–12';
      if (!inRange(r.day, 1, 30)) return 'hijriYearly.day must be an integer 1–30';
      return null;
    case 'hijriWindow':
      if (!inRange(r.month, 1, 12)) return 'hijriWindow.month must be an integer 1–12';
      if (!inRange(r.fromDay, 1, 30)) return 'hijriWindow.fromDay must be an integer 1–30';
      if (!inRange(r.toDay, 1, 30)) return 'hijriWindow.toDay must be an integer 1–30';
      if (r.fromDay > r.toDay) return 'hijriWindow.fromDay must be ≤ toDay';
      return null;
    default:
      return 'unknown rule kind';
  }
}

function assertRule(rule: Rule): void {
  const err = validateRule(rule);
  if (err) throw new RangeError(`Invalid rule: ${err}`);
}

function offsetOf(opts?: RuleOptions): number {
  const off = opts?.hijriOffset ?? 0;
  assertHijriOffset(off);
  return off;
}

/** Day test without validation (callers validate once). */
function matches(rule: Rule, date: LocalDate, hijriOffset: number): boolean {
  switch (rule.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return rule.days.includes(weekday(date));
    case 'everyNDays': {
      const d = diffDays(rule.anchor, date);
      return d >= 0 && d % rule.n === 0;
    }
    case 'everyNWeeks': {
      const first = firstWeekdayOnOrAfter(rule.anchor, rule.weekday);
      const d = diffDays(first, date);
      return d >= 0 && d % (7 * rule.n) === 0;
    }
    case 'monthlyDay':
      return Number(date.slice(8, 10)) === rule.day;
    case 'hijriMonthDays':
      return rule.days.includes(toHijri(date, hijriOffset).day);
    case 'hijriYearly': {
      const h = toHijri(date, hijriOffset);
      return h.month === rule.month && h.day === rule.day;
    }
    case 'hijriWindow': {
      const h = toHijri(date, hijriOffset);
      return h.month === rule.month && h.day >= rule.fromDay && h.day <= rule.toDay;
    }
  }
}

/** First date on or after `date` that falls on `wd` (0 = Sunday). */
export function firstWeekdayOnOrAfter(date: LocalDate, wd: number): LocalDate {
  return addDays(date, (wd - weekday(date) + 7) % 7);
}

/** True when the rule fires on `date`. */
export function isDue(rule: Rule, date: LocalDate, opts?: RuleOptions): boolean {
  assertRule(rule);
  if (!isValidDate(date)) throw new RangeError('Invalid date: expected YYYY-MM-DD');
  return matches(rule, date, offsetOf(opts));
}

/**
 * Every date from `from` to `to` (both inclusive) on which the rule fires, ascending. Empty when `from > to`.
 * Throws for an invalid rule, an invalid date, or a span longer than {@link MAX_RANGE_DAYS}.
 */
export function occurrences(rule: Rule, from: LocalDate, to: LocalDate, opts?: RuleOptions): LocalDate[] {
  assertRule(rule);
  const off = offsetOf(opts);
  const start = toDayNumber(from);
  const end = toDayNumber(to);
  if (end - start + 1 > MAX_RANGE_DAYS) throw new RangeError(`Range longer than ${MAX_RANGE_DAYS} days`);
  const out: LocalDate[] = [];
  for (let n = start; n <= end; n++) {
    const date = fromDayNumber(n);
    if (matches(rule, date, off)) out.push(date);
  }
  return out;
}

/** The next `count` dates on or after `from` on which the rule fires, ascending. */
export function nextOccurrences(rule: Rule, from: LocalDate, count: number, opts?: RuleOptions): LocalDate[] {
  assertRule(rule);
  if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer');
  const off = offsetOf(opts);
  const start = toDayNumber(from);
  const out: LocalDate[] = [];
  for (let n = start; out.length < count && n - start < MAX_SEARCH_DAYS; n++) {
    const date = fromDayNumber(n);
    if (matches(rule, date, off)) out.push(date);
  }
  return out;
}
