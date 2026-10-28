/**
 * The popup's "today" numbers, all from @thekra/practice-core (no rule is reimplemented here):
 * monthly adherence band (excellent / good / gentle; no failure band, no streaks), the one-step increase
 * suggestion (only when `canIncrease`), the ebb («يومي ثقيل») and the Ramadan season.
 *
 * One adjustment: practice-core's adherence target is `activeDaysPerWeek` (2…7). A habit whose rule fires on
 * fewer days (e.g. Friday only) or whose days the user made quiet cannot reach that target, so the target is
 * capped at the reminder days the plan actually has. This only changes the number passed to practice-core.
 */
import {
  addDays,
  adherence,
  adherenceBand,
  canIncrease,
  diffDays,
  endEbb,
  increase,
  nextStep,
  normalize,
  occurrences,
  startEbb,
  startSeason,
  toHijri,
  weekday,
  type AdherenceBand,
  type LocalDate,
  type Plan,
  type Rule,
} from '@thekra/practice-core';

/** Adherence window: the last 28 days (practice-core HOLD_DAYS). */
export const WINDOW_DAYS = 28;

/** Reminder days per week (average over the last 28 days), or `null` when the rule has none. */
export function reminderDaysPerWeek(rule: Rule, quietDays: readonly number[], today: LocalDate, hijriOffset: number): number | null {
  const days = occurrences(rule, addDays(today, -(WINDOW_DAYS - 1)), today, { hijriOffset }).filter((d) => !quietDays.includes(weekday(d)));
  return days.length === 0 ? null : (days.length * 7) / WINDOW_DAYS;
}

/** The plan with `activeDaysPerWeek` capped at the days it can actually be done. For practice-core math only. */
export function effectivePlan(plan: Plan, rule: Rule, quietDays: readonly number[], today: LocalDate, hijriOffset: number): Plan {
  const perWeek = reminderDaysPerWeek(rule, quietDays, today, hijriOffset);
  if (perWeek === null || perWeek >= plan.activeDaysPerWeek) return plan;
  return { ...plan, activeDaysPerWeek: perWeek };
}

/** No band during the plan's first week: one or two days say nothing about consistency. */
export const BAND_MIN_AGE_DAYS = 7;

/**
 * Band over the last 28 days. Today counts once something is logged (it is still in progress otherwise).
 * `null` during the plan's first week.
 */
export function monthlyBand(plan: Plan, rule: Rule, quietDays: readonly number[], today: LocalDate, hijriOffset: number): AdherenceBand | null {
  if (diffDays(plan.createdOn, today) < BAND_MIN_AGE_DAYS) return null;
  const to = (plan.log[today] ?? 0) > 0 ? today : addDays(today, -1);
  const eff = effectivePlan(plan, rule, quietDays, today, hijriOffset);
  const ratio = adherence(eff, addDays(today, -(WINDOW_DAYS - 1)), to);
  return adherenceBand(ratio, diffDays(plan.createdOn, today));
}

/** The amount after one increase, or `null` when practice-core says it is not time yet. */
export function increaseSuggestion(plan: Plan, rule: Rule, quietDays: readonly number[], today: LocalDate, hijriOffset: number): number | null {
  const eff = effectivePlan(normalize(plan, today), rule, quietDays, today, hijriOffset);
  if (!canIncrease(eff, today)) return null;
  return increase(eff, today).amount;
}

/** Applies one increase (practice-core `increase`). Throws when it is not allowed. */
export function applyIncrease(plan: Plan, rule: Rule, quietDays: readonly number[], today: LocalDate, hijriOffset: number): Plan {
  const eff = effectivePlan(normalize(plan, today), rule, quietDays, today, hijriOffset);
  return { ...increase(eff, today), activeDaysPerWeek: plan.activeDaysPerWeek };
}

export function setEbb(plan: Plan, on: boolean, today: LocalDate): Plan {
  return on ? startEbb(plan, today) : endEbb(plan);
}

/** Last day of the current Ramadan (Hijri month 9 with the user's offset), or `null` outside Ramadan. */
export function ramadanEnd(today: LocalDate, hijriOffset: number): LocalDate | null {
  if (toHijri(today, hijriOffset).month !== 9) return null;
  let day = today;
  while (toHijri(addDays(day, 1), hijriOffset).month === 9) day = addDays(day, 1);
  return day;
}

/** The season amount: one ladder step above the everyday amount, capped at the ceiling. `null` if none. */
export function seasonAmount(plan: Plan): number | null {
  const base = plan.season ? plan.season.previous : plan.amount;
  const next = nextStep(base);
  if (next === null) return null;
  const amount = plan.ceiling !== undefined ? Math.min(next, plan.ceiling) : next;
  return amount > base ? amount : null;
}

/**
 * Turns the Ramadan season on (until the last day of Ramadan, practice-core `startSeason`) or off (the season
 * ends yesterday and practice-core `normalize` restores the everyday amount, with no penalty).
 */
export function setSeason(plan: Plan, on: boolean, today: LocalDate, hijriOffset: number): Plan {
  if (!on) {
    if (!plan.season) return plan;
    return normalize({ ...plan, season: { ...plan.season, until: addDays(today, -1) } }, today);
  }
  const until = ramadanEnd(today, hijriOffset);
  const amount = seasonAmount(plan);
  if (until === null || amount === null) throw new Error('No Ramadan season available today');
  return startSeason(plan, amount, until);
}
