/**
 * Small pure helpers for the practice screens. Western digits only (PROJECT_GUIDE §3.7): nothing here
 * uses `toLocaleString`, which would give Arabic-Indic digits on an Arabic device.
 */

import { addDays, weekday, type LocalDate, type LocalTime, type Rule } from '@thekra/practice-core';

/** Arabic-Indic and Persian digits typed by the user → Western digits. */
export function toWesternDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/** «30/10» (day/month), Western digits. */
export function shortDate(date: LocalDate): string {
  return `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;
}

/** Current local wall time as HH:MM. */
export function nowTime(now: Date = new Date()): LocalTime {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Today at `time` on the device clock (the value a native time picker starts from). */
export function timeToDate(time: LocalTime, today: Date = new Date()): Date {
  const date = new Date(today);
  date.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
  return date;
}

/** «21:00» on a 24-hour device, «9:00 م» / «9:00 PM» on a 12-hour one; Western digits either way. */
export function displayTime(time: LocalTime, uses24hourClock: boolean, dayPeriod: { am: string; pm: string }): string {
  if (uses24hourClock) return time;
  const h = Number(time.slice(0, 2));
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${time.slice(3, 5)} ${h < 12 ? dayPeriod.am : dayPeriod.pm}`;
}

export function compareTime(a: LocalTime, b: LocalTime): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Sorted unique HH:MM list. */
export function sortSlots(slots: readonly LocalTime[]): LocalTime[] {
  return [...new Set(slots)].sort(compareTime);
}

/** Weekdays (0 = Sunday) a simple rule fires on, or null when the rule is not weekday-shaped. */
export function ruleToWeekdays(rule: Rule): number[] | null {
  switch (rule.kind) {
    case 'daily':
      return [0, 1, 2, 3, 4, 5, 6];
    case 'weekdays':
      return [...rule.days].sort();
    case 'everyNWeeks':
      return rule.n === 1 ? [rule.weekday] : null;
    default:
      return null;
  }
}

/** All 7 days → daily; otherwise a weekdays rule. Empty → null (invalid). */
export function weekdaysToRule(days: readonly number[]): Rule | null {
  const unique = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (unique.length === 0) return null;
  if (unique.length === 7) return { kind: 'daily' };
  return { kind: 'weekdays', days: unique };
}

/** The first day on or after `from` whose weekday is in `days` (for display). */
export function nextWeekdayFrom(from: LocalDate, days: readonly number[]): LocalDate {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (days.includes(weekday(d))) return d;
  }
  return from;
}
