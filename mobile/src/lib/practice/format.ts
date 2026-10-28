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

/** «9:5», «09.05», «٩:٠٥» → «09:05»; anything else → null. */
export function normalizeTimeInput(text: string): LocalTime | null {
  const m = /^\s*(\d{1,2})\s*[:.٫]\s*(\d{2})\s*$/.exec(toWesternDigits(text));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** «30/10» (day/month), Western digits. */
export function shortDate(date: LocalDate): string {
  return `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;
}

/** Current local wall time as HH:MM. */
export function nowTime(now: Date = new Date()): LocalTime {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
