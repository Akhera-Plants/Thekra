/**
 * «الأيام» of a habit (round 5, A-13 a): the member picks the weekdays themselves, and the count per week is computed
 * from them («3 أيام في الأسبوع»). Stored as the plan's own `rule` (`weekdays`), or no rule for every day. Pure.
 */
import { nowIso, validatePlan, type IsoTime, type Plan, type Rule } from '@thekra/practice-core';

export const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** The weekdays a plan asks for (its rule, else the catalog's, else every day); null for a rule that is not by weekday. */
export function planWeekdays(plan: Pick<Plan, 'rule'>, fallback?: Rule): number[] | null {
  const rule = plan.rule ?? fallback;
  if (!rule || rule.kind === 'daily') return [...ALL_DAYS];
  if (rule.kind === 'weekdays') return [...rule.days].sort((a, b) => a - b);
  return null;
}

/** The plan with these weekdays (at least one): every day drops the rule; the count per week follows the days. */
export function withWeekdays(plan: Plan, days: readonly number[], now: IsoTime = nowIso()): Plan {
  const unique = [...new Set(days)].filter((d) => ALL_DAYS.includes(d)).sort((a, b) => a - b);
  if (unique.length === 0) throw new RangeError('Pick at least one day');
  const next: Plan = { ...plan, activeDaysPerWeek: unique.length, updatedAt: now };
  if (unique.length === ALL_DAYS.length) delete next.rule;
  else next.rule = { kind: 'weekdays', days: unique };
  const err = validatePlan(next);
  if (err) throw new RangeError(`Invalid plan: ${err}`);
  return next;
}

/** True when the plan already asks for exactly these days. */
export function sameWeekdays(plan: Pick<Plan, 'rule'>, days: readonly number[], fallback?: Rule): boolean {
  const current = planWeekdays(plan, fallback);
  return current !== null && current.join() === [...new Set(days)].sort((a, b) => a - b).join();
}
