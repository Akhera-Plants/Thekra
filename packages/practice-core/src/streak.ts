/**
 * «سجلّي» streak (owner decision 2026-10-31, replacing the earlier "no streaks" rule): the run of complete days.
 *
 * - A day is complete when every plan it asks for ({@link planAsksOn}, with the same `defaultRuleOf` and
 *   `hijriOffset` as the agenda and the reminders) has something logged (`log > 0`; any amount counts).
 * - On «يومي ثقيل» ({@link isEbbOn} for any plan asked that day) the day is complete when anything at all was logged.
 * - A day that asks for nothing is skipped: it neither breaks the run nor adds to it.
 * - Today counts only once complete; until then the current streak is the run that ended yesterday.
 *
 * Only habit plans count. Relatives and the private program never enter a streak (the program stays generic).
 * Pure; the store is not changed.
 */
import { addDays, type LocalDate } from './dates.js';
import { planAsksOn, type PlanDayOptions } from './agenda.js';
import { isEbbOn } from './plan.js';
import type { Store } from './storage.js';

/** How one day stands for the streak. */
export type StreakDay = 'complete' | 'incomplete' | 'skipped';

/** Whether `date` is complete, incomplete, or asks for nothing (skipped). */
export function streakDay(store: Store, date: LocalDate, opts: PlanDayOptions = {}): StreakDay {
  const asked = store.plans.filter((p) => planAsksOn(p, date, opts));
  if (asked.length === 0) return 'skipped';
  if (asked.some((p) => isEbbOn(p, date))) {
    return store.plans.some((p) => (p.log[date] ?? 0) > 0) ? 'complete' : 'incomplete';
  }
  return asked.every((p) => (p.log[date] ?? 0) > 0) ? 'complete' : 'incomplete';
}

/** The first day any plan exists, or null without plans: nothing before it can be asked. */
function firstPlanDay(store: Store): LocalDate | null {
  let first: LocalDate | null = null;
  for (const p of store.plans) if (first === null || p.createdOn < first) first = p.createdOn;
  return first;
}

/** Complete days in a row up to `today` (today only when complete; skipped days pass through). */
export function currentStreak(store: Store, today: LocalDate, opts: PlanDayOptions = {}): number {
  const first = firstPlanDay(store);
  if (first === null) return 0;
  let count = 0;
  for (let d = today; d >= first; d = addDays(d, -1)) {
    const day = streakDay(store, d, opts);
    if (day === 'complete') count++;
    else if (day === 'incomplete' && d !== today) break;
  }
  return count;
}

/** The longest run of complete days from the first plan up to `today` (an incomplete today does not end a run). */
export function longestStreak(store: Store, today: LocalDate, opts: PlanDayOptions = {}): number {
  const first = firstPlanDay(store);
  if (first === null || first > today) return 0;
  let best = 0;
  let run = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const day = streakDay(store, d, opts);
    if (day === 'complete') best = Math.max(best, ++run);
    else if (day === 'incomplete' && d !== today) run = 0;
  }
  return best;
}
