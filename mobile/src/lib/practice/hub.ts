/**
 * Pure pieces of the «عاداتي» hub on top of practice-core's agenda (dayAgenda, presence, monthSummary): the
 * presence mark a day shows, which days can still be logged, when a tap finishes a day, the sunnah occasion days of
 * a range, and the counts on the track rows. No rule is re-implemented here; no streak or run length exists.
 */

import {
  activePrograms,
  actionable,
  dayAgenda,
  diffDays,
  dueList,
  isItemDone,
  occurrences,
  type AgendaItem,
  type AgendaOccasion,
  type DayPresence,
  type LocalDate,
  type PlanDayOptions,
  type Relative,
  type Store,
} from '@thekra/practice-core';

/** A day's mark under the week strip and in the month grid: nothing, some of it, all of it. */
export type PresenceMark = 'none' | 'partial' | 'full';

/** «أي قدر يُحسب»: any amount on a day shows at least a partial mark; a day that asked nothing but got something is full. */
export function presenceMark(day: DayPresence): PresenceMark {
  if (!day.asked) return day.present ? 'full' : 'none';
  if (day.share >= 1) return 'full';
  return day.present || day.share > 0 ? 'partial' : 'none';
}

export function presenceMarks(days: readonly DayPresence[]): Map<LocalDate, PresenceMark> {
  return new Map(days.map((d) => [d.date, presenceMark(d)]));
}

/** Today and the 6 days before it can be logged from the hub (the same week as «صحّح السجل»); the rest is view-only. */
export const LOG_WINDOW_DAYS = 7;

export function canLogOn(date: LocalDate, today: LocalDate): boolean {
  const back = diffDays(date, today);
  return back >= 0 && back < LOG_WINDOW_DAYS;
}

/** Every actionable item of the day is done (occasions are information, not tasks). */
export function isDayComplete(items: readonly AgendaItem[]): boolean {
  const tasks = actionable(items);
  return tasks.length > 0 && tasks.every(isItemDone);
}

/** An edit from `before` to `after` finished `date`: its last open task is now done. */
export function finishedDay(before: Store, after: Store, date: LocalDate, planDays: PlanDayOptions = {}): boolean {
  return !isDayComplete(dayAgenda(before, date, planDays)) && isDayComplete(dayAgenda(after, date, planDays));
}

/** Days from `from` to `to` with a sunnah occasion (practice-core `occurrences`; a Hijri rule the runtime cannot place is skipped). */
export function occasionDates(occasions: readonly AgendaOccasion[], from: LocalDate, to: LocalDate, hijriOffset: number): Set<LocalDate> {
  const out = new Set<LocalDate>();
  for (const o of occasions) {
    try {
      for (const d of occurrences(o.rule, from, to, { hijriOffset })) out.add(d);
    } catch {
      // Hijri rule without Umm al-Qura: no mark rather than a wrong one.
    }
  }
  return out;
}

/** Relatives whose turn has come: overdue, or due today. */
export function dueNowCount(relatives: readonly Relative[], today: LocalDate): number {
  const due = dueList(relatives, today);
  return due.overdue.length + due.thisWeek.filter((e) => e.daysUntilDue === 0).length;
}

/** The user has started something (a habit, a relative, a program): otherwise the hub shows the three ways to begin. */
export function hasStarted(store: Store): boolean {
  return store.plans.length > 0 || store.relatives.length > 0 || activePrograms(store.programs).length > 0;
}
