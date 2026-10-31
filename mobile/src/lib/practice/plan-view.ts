/**
 * What the habit screens show for one plan on one day, all from practice-core (no rules re-implemented here).
 */

import {
  addDays,
  adherence,
  adherenceBand,
  baseAmount,
  canIncrease,
  createPlan,
  diffDays,
  endEbb,
  isEbbOn,
  isHijriSupported,
  normalize,
  nextStep,
  relapseSuggestion,
  requiredOn,
  startEbb,
  status,
  targetDaysIn,
  toHijri,
  type AdherenceBand,
  type IsoTime,
  type LocalDate,
  type LocalTime,
  type Plan,
  type Rule,
  type Store,
  updatePlan,
} from '@thekra/practice-core';
import type { CatalogHabit, UiLocale } from './catalog-types';
import { pick } from './catalog-types';
import { planDueOn } from './reminders';

/** «A month» for the adherence band: the last 30 days including today. */
export const MONTH_DAYS = 30;

export interface PlanView {
  required: number;
  done: number;
  doneToday: boolean;
  remaining: number;
  /** Days with anything logged in the month window. */
  daysDone: number;
  /** Target active days in the month window (prorated, rounded). */
  targetDays: number;
  band: AdherenceBand;
  canIncrease: boolean;
  nextAmount: number | null;
  relapse: boolean;
  relapseAmount: number;
  inEbb: boolean;
  inSeason: boolean;
}

export function planView(stored: Plan, today: LocalDate): PlanView {
  // A season whose date has passed is over (practice-core `normalize`); computed here, not written back, because
  // a season's end is derived from the date on every device (practice-core README, Store v2).
  const plan = normalize(stored, today);
  const required = requiredOn(plan, today);
  const done = plan.log[today] ?? 0;
  const from = addDays(today, -(MONTH_DAYS - 1));
  const ratio = adherence(plan, from, today);
  const start = plan.createdOn > from ? plan.createdOn : from;
  let daysDone = 0;
  for (const [d, v] of Object.entries(plan.log)) if (v > 0 && d >= start && d <= today) daysDone++;
  const inc = canIncrease(plan, today);
  const next = nextStep(plan.amount);
  const base = baseAmount(plan);
  const relapse = status(plan, today) === 'relapse';
  const relapseAmount = relapseSuggestion(base);
  return {
    required,
    done,
    doneToday: done >= required,
    remaining: Math.max(0, required - done),
    daysDone,
    targetDays: Math.max(1, Math.round(targetDaysIn(plan, start, today))),
    band: adherenceBand(ratio, diffDays(plan.createdOn, today)),
    canIncrease: inc,
    // What practice-core `increase` will set: one ladder step, capped at the ceiling.
    nextAmount: inc && next !== null ? (plan.ceiling !== undefined ? Math.min(next, plan.ceiling) : next) : null,
    // Only suggest a cut when it really is lower than today's amount.
    relapse: relapse && relapseAmount < base,
    relapseAmount,
    inEbb: isEbbOn(plan, today),
    inSeason: Boolean(plan.season && today <= plan.season.until),
  };
}

/**
 * The «عاداتي» today list: habits asked for today first (practice-core `isPlanDueOn`, the same answer as the
 * reminders), then the others, which stay loggable because anything done still counts. Store order is kept.
 */
export function splitByDue(
  plans: readonly Plan[],
  habits: readonly CatalogHabit[],
  date: LocalDate,
  hijriOffset: number,
): { due: Plan[]; notDue: Plan[] } {
  const due: Plan[] = [];
  const notDue: Plan[] = [];
  for (const p of plans) (planDueOn(p, habits, date, hijriOffset) ? due : notDue).push(p);
  return { due, notDue };
}

/**
 * «يومي ثقيل» is one day (practice-core `isEbbOn`): the switch is on when every plan is lightened for `date`, and
 * it is off again by itself the next day.
 */
export function heavyDayOn(plans: readonly Plan[], date: LocalDate): boolean {
  return plans.length > 0 && plans.every((p) => isEbbOn(p, date));
}

/**
 * Turns «يومي ثقيل» on for `date` (practice-core `startEbb` on every plan not already lightened that day) or off
 * (`endEbb` on the plans lightened that day). Goes through `updatePlan` so `updatedAt` is stamped for sync.
 */
export function setHeavyDay(store: Store, on: boolean, date: LocalDate, now?: IsoTime): Store {
  return store.plans.reduce((acc, p) => {
    const lightened = isEbbOn(p, date);
    if (on === lightened) return acc;
    return updatePlan(acc, p.id, (cur) => (on ? startEbb(cur, date, now) : endEbb(cur, now)), now);
  }, store);
}

export type Distance = 'far' | 'near';

/** The start amount: the catalog's reviewed unit for this habit, else practice-core's `startSuggestion`. */
export function startAmount(habit: CatalogHabit, distance: Distance, fallback: (d: Distance) => number): number {
  const v = habit.start?.[distance];
  return typeof v === 'number' && v > 0 ? v : fallback(distance);
}

export function planFromHabit(args: {
  id: string;
  habit: CatalogHabit;
  amount: number;
  slots: LocalTime[];
  activeDaysPerWeek: number;
  rule: Rule;
  today: LocalDate;
  locale: UiLocale;
}): Plan {
  const { habit } = args;
  return createPlan({
    id: args.id,
    habitKey: habit.key,
    rule: args.rule,
    deedSlug: habit.deed,
    title: pick(habit, 'title', args.locale),
    unit: habit.unit,
    amount: args.amount,
    ...(habit.ceiling !== undefined ? { ceiling: habit.ceiling } : {}),
    activeDaysPerWeek: args.activeDaysPerWeek,
    slots: args.slots,
    createdOn: args.today,
  });
}

/**
 * Last day of the season for «وضع رمضان»: the last day of the current Ramadan when today is in Ramadan
 * (Umm al-Qura + the user's offset), else 30 days from today. `hijri` is false when the runtime lacks
 * Umm al-Qura, in which case the 30-day season is used.
 */
export function ramadanSeasonUntil(today: LocalDate, hijriOffset: number): { until: LocalDate; inRamadan: boolean } {
  if (isHijriSupported()) {
    try {
      if (toHijri(today, hijriOffset).month === 9) {
        let d = today;
        while (toHijri(addDays(d, 1), hijriOffset).month === 9) d = addDays(d, 1);
        return { until: d, inRamadan: true };
      }
    } catch {
      // fall through to the plain 30-day season
    }
  }
  return { until: addDays(today, 29), inRamadan: false };
}

/** One ladder step up for the season, capped at the plan's ceiling. */
export function seasonAmount(plan: Plan): number {
  const base = baseAmount(plan);
  const next = nextStep(base) ?? base;
  return plan.ceiling !== undefined ? Math.max(base, Math.min(next, plan.ceiling)) : next;
}
