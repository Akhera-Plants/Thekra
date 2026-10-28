/**
 * Local calendar dates as `YYYY-MM-DD` strings and times as `HH:MM`.
 *
 * The public API never takes or returns `Date` objects for calendar days: a `Date` is an instant, and turning
 * it into a day depends on the device time zone. All arithmetic here runs on a day number computed with
 * `Date.UTC`, so it is independent of the host time zone and of daylight-saving changes.
 */

/** A local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;
/** A local wall-clock time, `HH:MM` (24-hour). */
export type LocalTime = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MS_PER_DAY = 86_400_000;

/** True for a real calendar date written as `YYYY-MM-DD` (years 1000–9999). */
export function isValidDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1000 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

/** True for `HH:MM` between `00:00` and `23:59`. */
export function isValidTime(value: unknown): value is LocalTime {
  return typeof value === 'string' && TIME_RE.test(value);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function assertDate(value: string, label = 'date'): void {
  if (!isValidDate(value)) throw new RangeError(`Invalid ${label}: expected YYYY-MM-DD`);
}

/** Splits a valid date into numbers. Throws on an invalid date. */
export function parseDate(date: LocalDate): { year: number; month: number; day: number } {
  assertDate(date);
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

/** Days since 1970-01-01 (may be negative). Throws on an invalid date. */
export function toDayNumber(date: LocalDate): number {
  const { year, month, day } = parseDate(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** Inverse of {@link toDayNumber}. */
export function fromDayNumber(dayNumber: number): LocalDate {
  const d = new Date(dayNumber * MS_PER_DAY);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function formatYmd(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** `date` plus `days` calendar days (negative to go back). */
export function addDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) throw new RangeError('days must be an integer');
  return fromDayNumber(toDayNumber(date) + days);
}

/** Number of days from `from` to `to` (`to - from`); negative when `to` is earlier. */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** Day of the week: 0 = Sunday … 6 = Saturday. */
export function weekday(date: LocalDate): number {
  // 1970-01-01 was a Thursday (4).
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** -1, 0 or 1. Valid `YYYY-MM-DD` strings also compare correctly as plain strings. */
export function compareDates(a: LocalDate, b: LocalDate): -1 | 0 | 1 {
  assertDate(a, 'first date');
  assertDate(b, 'second date');
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The later of two dates. */
export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return compareDates(a, b) >= 0 ? a : b;
}

/** The earlier of two dates. */
export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return compareDates(a, b) <= 0 ? a : b;
}

/** Every date from `from` to `to`, inclusive. Empty when `from > to`. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const start = toDayNumber(from);
  const end = toDayNumber(to);
  const out: LocalDate[] = [];
  for (let n = start; n <= end; n++) out.push(fromDayNumber(n));
  return out;
}

/**
 * The device's local calendar day for an instant. This is the only place a `Date` enters the API: call it
 * once with `new Date()` at the edge of the app and pass the string everywhere else.
 */
export function todayFrom(now: Date): LocalDate {
  if (Number.isNaN(now.getTime())) throw new RangeError('Invalid Date');
  return formatYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Minutes since midnight for a valid `HH:MM`. */
export function timeToMinutes(time: LocalTime): number {
  if (!isValidTime(time)) throw new RangeError('Invalid time: expected HH:MM');
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** An ISO 8601 UTC instant (`2026-10-28T18:00:00.000Z`), used for edit times and sync versions. */
export type IsoTime = string;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** True for an ISO 8601 date-time with a zone (`Z` or `±HH:MM`). */
export function isIsoTime(value: unknown): value is IsoTime {
  return typeof value === 'string' && ISO_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/** The current instant as ISO UTC. Every mutating helper takes `now` and defaults to this. */
export function nowIso(): IsoTime {
  return new Date().toISOString();
}

/** Milliseconds since the epoch for an ISO time; `-Infinity` when missing or invalid (an unknown edit is the oldest). */
export function isoMillis(value: string | null | undefined): number {
  if (!isIsoTime(value)) return Number.NEGATIVE_INFINITY;
  return Date.parse(value);
}
