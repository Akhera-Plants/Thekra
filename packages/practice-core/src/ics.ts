/**
 * RFC 5545 calendar files built on the device.
 *
 * - CRLF line endings; content lines folded at 75 octets of UTF-8 (Arabic letters are 2 octets each, so
 *   folding counts bytes, never splits a character, and continuation lines start with one space).
 * - TEXT values escape `\`, `;`, `,` and newlines.
 * - All-day events: `DTSTART;VALUE=DATE` + `DTEND;VALUE=DATE` (next day).
 * - Timed events: floating local time (`DTSTART:YYYYMMDDTHHMMSS`, no `Z`, no `TZID`), so the reminder fires at
 *   the same wall-clock time wherever the phone is.
 * - `DTSTAMP` is UTC and comes from the `now` argument (tests pass a fixed instant).
 *
 * No `RRULE` is ever written: RFC 5545 recurrence knows only the Gregorian calendar, so a Hijri rule
 * (الأيام البيض، عرفة، ست من شوال…) cannot be expressed. Callers expand any rule into explicit dates with
 * {@link occurrencesToEvents} (typically for the next 12 months) and re-export the file later.
 *
 * Privacy (roadmap §0.2): titles are shown on lock screens and synced to Google/Apple. Callers must pass a
 * generic title («تذكرة من ذكرى») for anything sensitive; never a sin name, and never a relative's name unless
 * the user turned that on.
 */
import { addDays, isValidDate, isValidTime, type LocalDate, type LocalTime } from './dates.js';
import { occurrences, type Rule, type RuleOptions } from './rules.js';

export interface IcsEvent {
  /** Globally unique and stable across exports (e.g. `relative-42-2026-11-06@thekra.app`). */
  uid: string;
  title: string;
  description?: string;
  date: LocalDate;
  /** Omit for an all-day event. */
  time?: LocalTime;
  /** Timed events only; ignored for all-day events. */
  durationMinutes?: number;
  url?: string;
  /** Adds a VALARM (display) this many minutes before the start. 0 = at the start. */
  alarmMinutesBefore?: number;
}

export interface BuildIcsInput {
  calendarName: string;
  events: IcsEvent[];
  prodId?: string;
  /** The DTSTAMP instant. Defaults to the current time. */
  now?: Date;
}

export const DEFAULT_PROD_ID = '-//Thekra//practice-core//AR';
const CRLF = '\r\n';
const MAX_OCTETS = 75;

/** Escapes a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Folds one content line so that no physical line exceeds 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  let limit = MAX_OCTETS;
  for (const ch of line) {
    const size = utf8Length(ch.codePointAt(0) ?? 0);
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
      limit = MAX_OCTETS - 1; // the leading space of a continuation line counts
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function compactDate(date: LocalDate): string {
  return date.replace(/-/g, '');
}

function utcStamp(now: Date): string {
  if (Number.isNaN(now.getTime())) throw new RangeError('Invalid now');
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function assertNoLineBreak(value: string, label: string): void {
  if (/[\r\n]/.test(value)) throw new RangeError(`${label} must not contain line breaks`);
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function eventLines(e: IcsEvent, stamp: string): string[] {
  if (!e.uid) throw new RangeError('event uid is required');
  if (!isValidDate(e.date)) throw new RangeError(`Invalid event date for uid ${e.uid}`);
  if (e.time !== undefined && !isValidTime(e.time)) throw new RangeError(`Invalid event time for uid ${e.uid}`);
  const lines = ['BEGIN:VEVENT', `UID:${escapeText(e.uid)}`, `DTSTAMP:${stamp}`];
  if (e.time === undefined) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(e.date, 1))}`);
  } else {
    lines.push(`DTSTART:${compactDate(e.date)}T${e.time.replace(':', '')}00`);
    if (e.durationMinutes !== undefined) {
      if (!isNonNegativeInt(e.durationMinutes)) throw new RangeError('durationMinutes must be a non-negative integer');
      lines.push(`DURATION:PT${e.durationMinutes}M`);
    }
  }
  lines.push(`SUMMARY:${escapeText(e.title)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.url) {
    assertNoLineBreak(e.url, 'url');
    lines.push(`URL:${e.url}`);
  }
  lines.push('TRANSP:TRANSPARENT');
  if (e.alarmMinutesBefore !== undefined) {
    if (!isNonNegativeInt(e.alarmMinutesBefore)) throw new RangeError('alarmMinutesBefore must be a non-negative integer');
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.title)}`,
      e.alarmMinutesBefore === 0 ? 'TRIGGER:PT0M' : `TRIGGER:-PT${e.alarmMinutesBefore}M`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/** Builds a complete VCALENDAR document. Every line ends with CRLF, including the last. */
export function buildIcs(input: BuildIcsInput): string {
  const prodId = input.prodId ?? DEFAULT_PROD_ID;
  assertNoLineBreak(prodId, 'prodId');
  const stamp = utcStamp(input.now ?? new Date());
  const name = escapeText(input.calendarName);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${name}`,
    `X-WR-CALNAME:${name}`,
  ];
  for (const e of input.events) lines.push(...eventLines(e, stamp));
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** Shared fields for events generated from a rule. Each event's uid is `${uidPrefix}-${YYYYMMDD}${uidSuffix}`. */
export interface EventBase extends Omit<IcsEvent, 'uid' | 'date'> {
  uidPrefix: string;
  /** Appended after the date, e.g. `@thekra.app`, to make the uid globally unique. Default `@thekra`. */
  uidSuffix?: string;
}

/** Expands a rule into explicit events (the Hijri-safe alternative to RRULE). */
export function occurrencesToEvents(
  rule: Rule,
  from: LocalDate,
  to: LocalDate,
  base: EventBase,
  opts?: RuleOptions,
): IcsEvent[] {
  const { uidPrefix, uidSuffix = '@thekra', ...rest } = base;
  return occurrences(rule, from, to, opts).map((date) => ({
    ...rest,
    uid: `${uidPrefix}-${compactDate(date)}${uidSuffix}`,
    date,
  }));
}
