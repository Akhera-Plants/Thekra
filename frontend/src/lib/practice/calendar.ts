/**
 * View-model for «التقويم»: dated occurrences (from the API, or computed on the device from the catalog)
 * grouped into one row per occasion with its next date and, for a window, the end of that run.
 */
import { addDays, buildIcs, diffDays, isHijriSupported, occurrences, toHijri, type LocalDate } from '@thekra/practice-core';
import type { OccasionDate, PracticeOccasion, ScheduleBasis } from '@/lib/types/practice';

/** One Hijri year and a little more, so every yearly occasion appears once. */
export const CALENDAR_RANGE_DAYS = 365;

export interface UpcomingOccasion {
  key: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  basis: ScheduleBasis;
  /** First date on or after today. */
  date: LocalDate;
  /** Last day of the consecutive run that starts on `date` (equal to `date` for a single day). */
  until: LocalDate;
  hijri: OccasionDate['hijri'];
  daysAway: number;
  /** Every date in the range, for the calendar file. */
  dates: LocalDate[];
}

/** Computes the dated list on the device (fallback when `GET /calendar/occasions` fails). */
export function computeOccasionDates(
  occasions: readonly PracticeOccasion[],
  from: LocalDate,
  to: LocalDate,
  hijriOffset: number,
): OccasionDate[] {
  const hijriOk = isHijriSupported();
  const out: OccasionDate[] = [];
  for (const occasion of occasions) {
    const usesHijri = occasion.rule.kind.startsWith('hijri');
    // A wrong Arafah date is worse than none: skip Hijri rules on runtimes without Umm al-Qura.
    if (usesHijri && !hijriOk) continue;
    for (const date of occurrences(occasion.rule, from, to, { hijriOffset })) {
      out.push({
        key: occasion.key,
        date,
        titleAr: occasion.titleAr,
        titleEn: occasion.titleEn,
        deed: occasion.deed,
        basis: occasion.basis,
        hijri: hijriOk ? toHijri(date, hijriOffset) : null,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** One row per occasion key, ordered by the next date (then title). Dates before `today` are ignored. */
export function groupOccasions(entries: readonly OccasionDate[], today: LocalDate): UpcomingOccasion[] {
  const byKey = new Map<string, OccasionDate[]>();
  for (const entry of entries) {
    if (entry.date < today) continue;
    const list = byKey.get(entry.key) ?? [];
    list.push(entry);
    byKey.set(entry.key, list);
  }
  const rows: UpcomingOccasion[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const first = sorted[0] as OccasionDate;
    let until = first.date;
    for (const entry of sorted.slice(1)) {
      if (diffDays(until, entry.date) !== 1) break;
      until = entry.date;
    }
    rows.push({
      key,
      titleAr: first.titleAr,
      titleEn: first.titleEn,
      deed: first.deed,
      basis: first.basis,
      date: first.date,
      until,
      hijri: first.hijri,
      daysAway: diffDays(today, first.date),
      dates: sorted.map((entry) => entry.date),
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key.localeCompare(b.key)));
}

export function calendarRange(today: LocalDate): { from: LocalDate; to: LocalDate } {
  return { from: today, to: addDays(today, CALENDAR_RANGE_DAYS) };
}

/** The visible list as an all-day `.ics`, built on the device (titles are public occasion names). */
export function occasionsIcs(
  rows: readonly UpcomingOccasion[],
  lang: 'ar' | 'en',
  calendarName: string,
  deedUrl: (deed: string) => string,
  now?: Date,
): string {
  const events = rows.flatMap((row) =>
    row.dates.map((date) => ({
      uid: `occasion-${row.key}-${date.replace(/-/g, '')}@thekra`,
      title: lang === 'en' ? row.titleEn : row.titleAr,
      date,
      url: deedUrl(row.deed),
    })),
  );
  return buildIcs({ calendarName, events, now });
}
