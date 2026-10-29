/**
 * Calendar math for the week strip and the month grid («عاداتي» hub and the calendar page), and the date labels
 * they show. Pure (no React Native), so it runs in Jest. Dates are practice-core local `YYYY-MM-DD` strings;
 * names come in from i18n, digits stay Western (PROJECT_GUIDE §3.7).
 */

import { addDays, isHijriSupported, toHijri, weekday, type HijriDate, type LocalDate } from '@thekra/practice-core';
import type { UiLocale } from './catalog-types';

/** The first day of the week: Saturday in Arabic (as on Arab calendars), Sunday in English. 0 = Sunday. */
export function firstWeekday(locale: UiLocale): number {
  return locale === 'ar' ? 6 : 0;
}

/** The first day of the week holding `date`. */
export function weekStart(date: LocalDate, first: number): LocalDate {
  return addDays(date, -((weekday(date) - first + 7) % 7));
}

/** The 7 days of the week holding `date`, in reading order (the first day at the reading start). */
export function weekDays(date: LocalDate, first: number): LocalDate[] {
  const start = weekStart(date, first);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The 7 weekday numbers (0 = Sunday) in the order a week starting on `first` shows them. */
export function weekdayOrder(first: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (first + i) % 7);
}

/** The first day of the month holding `date`. */
export function monthStart(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

/** The last day of the month holding `date`. */
export function monthEnd(date: LocalDate): LocalDate {
  return addDays(addMonths(monthStart(date), 1), -1);
}

/** The first day of the month `delta` months after the month holding `date`. */
export function addMonths(date: LocalDate, delta: number): LocalDate {
  const index = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + delta;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

/**
 * The month holding `date` as weeks of 7 cells in reading order; days outside the month are null (blank cells),
 * so every row has 7 cells and the first day sits under its weekday.
 */
export function monthWeeks(date: LocalDate, first: number): (LocalDate | null)[][] {
  const start = monthStart(date);
  const end = monthEnd(date);
  const weeks: (LocalDate | null)[][] = [];
  let day = weekStart(start, first);
  while (day <= end) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(day, i);
      return d >= start && d <= end ? d : null;
    });
    weeks.push(week);
    day = addDays(day, 7);
  }
  return weeks;
}

/** Umm al-Qura with the user's offset, or null where the runtime lacks it (a wrong Hijri date is worse than none). */
export function safeHijri(date: LocalDate, hijriOffset: number): HijriDate | null {
  if (!isHijriSupported()) return null;
  try {
    return toHijri(date, hijriOffset);
  } catch {
    return null;
  }
}

export interface DateNames {
  /** 0 = Sunday. */
  weekday: (day: number) => string;
  /** 1…12. */
  gregorianMonth: (month: number) => string;
  /** 1…12. */
  hijriMonth: (month: number) => string;
}

function gregorian(date: LocalDate, names: DateNames): string {
  return `${Number(date.slice(8, 10))} ${names.gregorianMonth(Number(date.slice(5, 7)))}`;
}

/** «الخميس 17 جمادى الأولى 1448 · 29 أكتوبر»; without Hijri support «الخميس 29 أكتوبر». */
export function dayTitle(date: LocalDate, hijriOffset: number, names: DateNames): string {
  const h = safeHijri(date, hijriOffset);
  const day = names.weekday(weekday(date));
  if (!h) return `${day} ${gregorian(date, names)}`;
  return `${day} ${h.day} ${names.hijriMonth(h.month)} ${h.year} · ${gregorian(date, names)}`;
}

/** «الخميس 29 أكتوبر»: the day list header for a day other than today. */
export function shortDayTitle(date: LocalDate, names: DateNames): string {
  return `${names.weekday(weekday(date))} ${gregorian(date, names)}`;
}

/** «أكتوبر 2026». */
export function monthTitle(date: LocalDate, names: DateNames): string {
  return `${names.gregorianMonth(Number(date.slice(5, 7)))} ${date.slice(0, 4)}`;
}

/**
 * The Hijri months a Gregorian month touches: «ربيع الآخر، جمادى الأولى 1448», or with the year on each side when
 * it changes inside the month («ذو الحجة 1447، محرم 1448»). Null without Hijri support.
 */
export function hijriMonthsTitle(date: LocalDate, hijriOffset: number, names: DateNames, separator: string): string | null {
  const months: HijriDate[] = [];
  for (let d = monthStart(date), end = monthEnd(date); d <= end; d = addDays(d, 1)) {
    const h = safeHijri(d, hijriOffset);
    if (!h) return null;
    const last = months[months.length - 1];
    if (!last || last.month !== h.month || last.year !== h.year) months.push(h);
  }
  const sameYear = months.every((h) => h.year === months[0]!.year);
  const parts = months.map((h, i) =>
    sameYear && i < months.length - 1 ? names.hijriMonth(h.month) : `${names.hijriMonth(h.month)} ${h.year}`,
  );
  return parts.join(separator);
}
