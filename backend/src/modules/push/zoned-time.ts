import type { LocalDate, LocalTime } from '@thekra/practice-core';

/**
 * Wall-clock dates in a browser's IANA time zone, with Intl only (no time-zone data of our own). Reminders are
 * planned in the browser's zone (the slots a user picks are local times) and handed to the scheduler as UTC.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function wallClockMillis(instant: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
}

/** The local date and time (minutes) of `instant` in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string): { date: LocalDate; time: LocalTime } {
  const iso = new Date(wallClockMillis(instant.getTime(), timeZone)).toISOString();
  return { date: iso.slice(0, 10) as LocalDate, time: iso.slice(11, 16) as LocalTime };
}

/**
 * The instant at which the clocks of `timeZone` show `date` `time` (two passes over the zone offset). Around a
 * daylight-saving change a skipped or repeated local time lands within the hour of the change, which is close
 * enough for a reminder.
 */
export function zonedToUtc(date: LocalDate, time: LocalTime, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const offsetAt = (instant: number) => wallClockMillis(instant, timeZone) - instant;
  return new Date(wall - offsetAt(wall - offsetAt(wall)));
}
