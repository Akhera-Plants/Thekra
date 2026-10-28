/** Dates for the practice pages: Western digits in both languages (content rule §3.7). */
import { parseDate, type LocalDate } from '@thekra/practice-core';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: 'ar' | 'en', withWeekday: boolean): Intl.DateTimeFormat {
  const key = `${locale}-${withWeekday}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
      weekday: withWeekday ? 'long' : undefined,
      day: 'numeric',
      month: 'long',
      year: withWeekday ? 'numeric' : undefined,
      // The instant is noon UTC of the wanted day; formatting it in UTC keeps the day on every device.
      timeZone: 'UTC',
    });
    formatters.set(key, f);
  }
  return f;
}

/** «الأربعاء 28 أكتوبر 2026» / "Wednesday 28 October 2026" (with weekday), or «28 أكتوبر» / "28 October". */
export function formatGregorian(date: LocalDate, locale: 'ar' | 'en', withWeekday = false): string {
  const { year, month, day } = parseDate(date);
  return formatter(locale, withWeekday).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
