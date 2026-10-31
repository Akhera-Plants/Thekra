/**
 * View-model for «عاداتي» (the hub) and the month grids it shares with «التقويم»: weeks, months, which days can be
 * logged, presence marks and the track summaries. Every rule comes from @thekra/practice-core (`dayAgenda`,
 * `presence`, `monthSummary`, `dueList`); this file only shapes dates and counts for the page.
 */
import {
  activePrograms,
  addDays,
  actionable,
  diffDays,
  dueList,
  isHijriSupported,
  isItemDone,
  monthSummary,
  parseDate,
  toHijri,
  weekday,
  type AdherenceBand,
  type AgendaItem,
  type DayPresence,
  type LocalDate,
  type PlanDayOptions,
  type Store,
} from '@thekra/practice-core';

/** How far back a forgotten day can be logged or fixed (today and the 6 days before it): «صحّح السجل». */
export const EDITABLE_DAYS = 7;
/** Saturday opens the week in Arabic; Monday in English (the en-GB dates the site uses). */
const WEEK_START = { ar: 6, en: 1 } as const;
const DAYS_IN_WEEK = 7;

export interface YearMonth {
  year: number;
  /** 1…12. */
  month: number;
}

export function weekStartFor(locale: 'ar' | 'en'): number {
  return WEEK_START[locale];
}

/** The seven days of the week that holds `date`, in reading order. */
export function weekOf(date: LocalDate, weekStart: number): LocalDate[] {
  const back = (weekday(date) - weekStart + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const first = addDays(date, -back);
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(first, i));
}

export function monthOf(date: LocalDate): YearMonth {
  const { year, month } = parseDate(date);
  return { year, month };
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** -1, 0 or 1. */
export function compareMonths(a: YearMonth, b: YearMonth): number {
  return Math.sign(a.year * 12 + a.month - (b.year * 12 + b.month));
}

export function firstOfMonth(ym: YearMonth): LocalDate {
  return `${String(ym.year).padStart(4, '0')}-${String(ym.month).padStart(2, '0')}-01`;
}

export function lastOfMonth(ym: YearMonth): LocalDate {
  return addDays(firstOfMonth(shiftMonth(ym, 1)), -1);
}

export function isInMonth(date: LocalDate, ym: YearMonth): boolean {
  return compareMonths(monthOf(date), ym) === 0;
}

/**
 * The month as weeks of seven cells in reading order; days of the neighbouring months are `null` (blank cells).
 * Four to six rows.
 */
export function monthWeeks(ym: YearMonth, weekStart: number): (LocalDate | null)[][] {
  const first = firstOfMonth(ym);
  const last = lastOfMonth(ym);
  const lead = (weekday(first) - weekStart + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const count = diffDays(first, last) + 1;
  const cells: (LocalDate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null);
  const weeks: (LocalDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += DAYS_IN_WEEK) weeks.push(cells.slice(i, i + DAYS_IN_WEEK));
  return weeks;
}

/** A day can be logged from the hub when it is today or one of the {@link EDITABLE_DAYS} − 1 days before it. */
export function canLogOn(date: LocalDate, today: LocalDate): boolean {
  const back = diffDays(date, today);
  return back >= 0 && back < EDITABLE_DAYS;
}

export type PresenceLevel = 'none' | 'empty' | 'partial' | 'full';

/**
 * The small mark under a day: nothing for a future day or a day that asked nothing, an empty ring when nothing was
 * done, a partial fill when something was («أي قدر يُحسب»), full when every item was done. Never a run length.
 */
export function presenceLevel(day: DayPresence | undefined, today: LocalDate): PresenceLevel {
  if (!day || day.date > today) return 'none';
  if (!day.asked) return day.present ? 'full' : 'none';
  if (day.share >= 1) return 'full';
  if (day.present || day.share > 0) return 'partial';
  return 'empty';
}

/** True when the day asks for something and all of it is done: the quiet hopeful line. */
export function isDayComplete(items: readonly AgendaItem[]): boolean {
  const tasks = actionable(items);
  return tasks.length > 0 && tasks.every(isItemDone);
}

/** Nothing set up in any track yet: the hub shows the three start choices instead of the tracks. */
export function isFirstRun(store: Store): boolean {
  return store.plans.length === 0 && store.relatives.length === 0 && activePrograms(store.programs).length === 0;
}

export interface TrackSummary {
  habits: number;
  /** The kind band of the last 30 days, or null without plans. */
  band: AdherenceBand | null;
  /** Days in the last 30 with anything done. */
  presentDays: number;
  relatives: number;
  /** Relatives due today or overdue. */
  relativesDue: number;
  hasProgram: boolean;
}

export function trackSummary(store: Store, today: LocalDate, planDays: PlanDayOptions = {}): TrackSummary {
  const month = monthSummary(store, today, undefined, planDays);
  const due = dueList(store.relatives, today);
  return {
    habits: store.plans.length,
    band: month.band,
    presentDays: month.presentDays,
    relatives: store.relatives.length,
    relativesDue: [...due.overdue, ...due.thisWeek].filter((entry) => entry.daysUntilDue <= 0).length,
    hasProgram: activePrograms(store.programs).length > 0,
  };
}

export interface HijriMonthSpan {
  from: YearMonth;
  to: YearMonth;
}

/** The Hijri month(s) a Gregorian month spans (the user's offset applied), or null without Umm al-Qura. */
export function hijriMonthSpan(ym: YearMonth, hijriOffset: number): HijriMonthSpan | null {
  if (!isHijriSupported()) return null;
  const a = toHijri(firstOfMonth(ym), hijriOffset);
  const b = toHijri(lastOfMonth(ym), hijriOffset);
  return { from: { year: a.year, month: a.month }, to: { year: b.year, month: b.month } };
}
