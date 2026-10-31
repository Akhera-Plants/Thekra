/**
 * «سجلّي» streak («المداومة», owner decision 2026-10-31, replacing the earlier "no streaks" rule): the run of
 * complete days, with mercy (redesign §3):
 *
 * - A day is complete when every plan it asks for ({@link planAsksOn}, with the same `defaultRuleOf` and
 *   `hijriOffset` as the agenda and the reminders) has something logged that counts ({@link countsOn}).
 * - «يومي ثقيل»: on a day with an ebb ({@link isEbbOn}) the minimum counts: anything at all logged completes it.
 * - A day that asks for nothing is skipped: it neither breaks the run nor adds to it. A paused plan asks for nothing
 *   while paused, so it never enters the streak.
 * - «عذر» (sick or travelling, `settings.excusedDays`): the day is skipped too.
 * - «قضاء»: a day may be made up until noon of the next day ({@link makeUpDeadline}). Until then an incomplete
 *   yesterday does not end the run (it is still open, like today). A log written after that (a correction stamped
 *   later, `logCorrectedAt`) is kept in the record but does not count for the streak. Plain `logDone` has no time:
 *   the clients offer it only for today and, before noon, yesterday ({@link canMakeUp}); later fixes go through
 *   `correctLog` (see {@link logForDay}).
 * - Today counts only once complete; until then the current streak is the run that ended yesterday.
 *
 * Only habit plans count. Relatives and the private program never enter a streak (the program stays generic).
 * Pure; the store is not changed.
 */
import { addDays, isoMillis, parseDate, type IsoTime, type LocalDate } from './dates.js';
import { planAsksOn, type PlanDayOptions } from './agenda.js';
import { correctLog, isEbbOn, logDone, type Plan } from './plan.js';
import { isExcused, type Store } from './storage.js';

/** Local hour of the next day until which a day can be made up («قضاء»; Dhuhr when prayer times are unknown). */
export const MAKE_UP_HOUR = 12;

/** How one day stands for the streak. */
export type StreakDay = 'complete' | 'incomplete' | 'skipped';

export interface StreakOptions extends PlanDayOptions {
  /** The current time in milliseconds (default `Date.now()`): decides whether yesterday can still be made up. */
  now?: number;
  /**
   * The end of the make-up window of `date` in milliseconds. Default {@link makeUpDeadline} in the runtime's time
   * zone (the user's device).
   */
  deadlineOf?: (date: LocalDate) => number;
}

/** Noon (local time of the runtime) of the day after `date`, in milliseconds: the end of its «قضاء» window. */
export function makeUpDeadline(date: LocalDate, hour = MAKE_UP_HOUR): number {
  const { year, month, day } = parseDate(date);
  return new Date(year, month - 1, day + 1, hour, 0, 0, 0).getTime();
}

/** True while `date` can still be logged for the streak at `now`: today, or yesterday before its deadline. */
export function canMakeUp(date: LocalDate, today: LocalDate, now: number = Date.now(), deadlineOf = makeUpDeadline): boolean {
  if (date === today) return true;
  return date === addDays(today, -1) && now < deadlineOf(date);
}

/**
 * Logs `amount` on `date` the way the streak expects: a plain add (`logDone`) inside the make-up window, otherwise a
 * correction stamped `nowIso` (the amount is kept in the record; the streak ignores it). Use for every log of a past day.
 */
export function logForDay(
  plan: Plan,
  date: LocalDate,
  amount: number,
  today: LocalDate,
  nowIso: IsoTime = new Date().toISOString(),
  deadlineOf = makeUpDeadline,
): Plan {
  if (canMakeUp(date, today, isoMillis(nowIso), deadlineOf)) return logDone(plan, date, amount);
  return correctLog(plan, date, (plan.log[date] ?? 0) + amount, nowIso);
}

/** True when the plan's log on `date` counts for the streak: above 0 and written before the make-up deadline. */
export function countsOn(plan: Plan, date: LocalDate, deadlineOf: (date: LocalDate) => number = makeUpDeadline): boolean {
  if ((plan.log[date] ?? 0) <= 0) return false;
  const corrected = plan.logCorrectedAt?.[date];
  return corrected === undefined || isoMillis(corrected) <= deadlineOf(date);
}

/** Whether `date` is complete, incomplete, or asks for nothing (skipped; also an excused day). */
export function streakDay(store: Store, date: LocalDate, opts: StreakOptions = {}): StreakDay {
  if (isExcused(store, date)) return 'skipped';
  const asked = store.plans.filter((p) => planAsksOn(p, date, opts));
  if (asked.length === 0) return 'skipped';
  const deadlineOf = opts.deadlineOf ?? makeUpDeadline;
  if (asked.some((p) => isEbbOn(p, date))) {
    return store.plans.some((p) => countsOn(p, date, deadlineOf)) ? 'complete' : 'incomplete';
  }
  return asked.every((p) => countsOn(p, date, deadlineOf)) ? 'complete' : 'incomplete';
}

/** The first day any plan exists, or null without plans: nothing before it can be asked. */
function firstPlanDay(store: Store): LocalDate | null {
  let first: LocalDate | null = null;
  for (const p of store.plans) if (first === null || p.createdOn < first) first = p.createdOn;
  return first;
}

/** An incomplete day that may still be completed: today, or yesterday inside its make-up window. */
function isOpenDay(date: LocalDate, today: LocalDate, opts: StreakOptions): boolean {
  return canMakeUp(date, today, opts.now ?? Date.now(), opts.deadlineOf ?? makeUpDeadline);
}

/** Complete days in a row up to `today` (an open day does not break it; skipped and excused days pass through). */
export function currentStreak(store: Store, today: LocalDate, opts: StreakOptions = {}): number {
  const first = firstPlanDay(store);
  if (first === null) return 0;
  let count = 0;
  for (let d = today; d >= first; d = addDays(d, -1)) {
    const day = streakDay(store, d, opts);
    if (day === 'complete') count++;
    else if (day === 'incomplete' && !isOpenDay(d, today, opts)) break;
  }
  return count;
}

/** The longest run of complete days from the first plan up to `today` (an open day does not end a run). */
export function longestStreak(store: Store, today: LocalDate, opts: StreakOptions = {}): number {
  const first = firstPlanDay(store);
  if (first === null || first > today) return 0;
  let best = 0;
  let run = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const day = streakDay(store, d, opts);
    if (day === 'complete') best = Math.max(best, ++run);
    else if (day === 'incomplete' && !isOpenDay(d, today, opts)) run = 0;
  }
  return best;
}

/**
 * How the streak is shown, never 0 as a failure: `current` while there is a run; `fresh` (start again today, with the
 * longest run) when the run is 0 but there was one before; `none` before any complete day.
 */
export type StreakDisplay = { kind: 'current'; current: number; longest: number } | { kind: 'fresh'; longest: number } | { kind: 'none' };

export function streakDisplay(current: number, longest: number): StreakDisplay {
  if (current > 0) return { kind: 'current', current, longest: Math.max(current, longest) };
  return longest > 0 ? { kind: 'fresh', longest } : { kind: 'none' };
}
