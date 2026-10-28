/**
 * «أعِنّي على طاعة»: small, consistent deeds with guards against «وحش الزيادة» (the urge to increase too fast).
 *
 * Numbers come from the lecture analysis, docs/research/anas-sheikh-akrim/4EkrbmmIlno-analysis.md §4:
 * - start very small: 2 minutes for someone far from the habit, 5 for someone near (س 858–867);
 * - hold the start for about a month before any increase (س 863–866), then climb one small step at a time
 *   (5 → 7 → 10 → 15, never 5 → 15; س 889–891) up to a ceiling (س 892–912);
 * - 4–5 active days a week, 2–3 at the beginning (س 990–992, 1137, 1147); at least two time slots (س 1019–1042);
 * - same-day make-up, any amount counts («خربانة؟ صلّحها», س 434–449, 1028–1060);
 * - a missed day is never doubled the next day (س 1129–1136);
 * - adherence: ≥ 75% excellent, 50–70% fine at the beginning (س 1246–1251);
 * - ebb of the heart: lighten, never stop (س 1195–1219); seasons (Ramadan): increase, then return without
 *   counting it as failure (س 948–966);
 * - after a relapse cut the goal by 50–80% (س 1442–1460);
 * - obligations come first; free time is usually 2–5 hours (س 1332–1376).
 *
 * Every function is pure: plans are never mutated, new objects are returned.
 */
import { addDays, diffDays, isValidDate, isValidTime, maxDate, toDayNumber, fromDayNumber, type LocalDate, type LocalTime } from './dates.js';

export type PlanUnit = 'minutes' | 'count' | 'times';

export interface Plan {
  id: string;
  deedSlug: string;
  title: string;
  unit: PlanUnit;
  /** The amount per active day. During a season this is the season amount (see `season.previous`). */
  amount: number;
  /** Optional upper bound the plan never climbs past. */
  ceiling?: number;
  /** 2…7. */
  activeDaysPerWeek: number;
  /** Reminder times, `HH:MM`, at least one (the lecture recommends two or more). */
  slots: LocalTime[];
  createdOn: LocalDate;
  /** The day `amount` last changed through {@link increase} or {@link decreaseTo}. */
  amountChangedOn: LocalDate;
  /** Amount done per local date. Partial amounts on the same day add up. */
  log: Record<LocalDate, number>;
  /** «إدبار»: a low period; the plan asks only for a token amount while it lasts. */
  ebb?: { since: LocalDate };
  /** A season (e.g. Ramadan) with a higher amount until `until`, then back to `previous`. */
  season?: { amount: number; until: LocalDate; previous: number };
}

/** The only amounts a plan climbs through. Used for minutes and for count/times units alike. */
export const LADDER: readonly number[] = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 45, 60];
/** Days the amount must stay unchanged before an increase («شهرًا أو شهرين»: the minimum, one month). */
export const HOLD_DAYS = 28;
/** Adherence needed over the last {@link HOLD_DAYS} days before an increase. */
export const INCREASE_ADHERENCE = 0.75;
/** During an ebb the plan asks for this much (or less when the plan amount is already smaller). */
export const EBB_AMOUNT = 2;
/** The plan's first days, where 40% adherence still counts as "good". */
export const EARLY_DAYS = 60;
/** Days without anything done before the plan is in relapse. */
export const RELAPSE_DAYS = 7;
/** Share of free time nawafil may take before a load warning. */
export const LOAD_SHARE = 0.5;

export function startSuggestion(distance: 'far' | 'near'): number {
  return distance === 'far' ? 2 : 5;
}

/** The next ladder value above `amount`, or `null` at the top. Off-ladder amounts go to the next ladder value. */
export function nextStep(amount: number): number | null {
  for (const v of LADDER) if (v > amount) return v;
  return null;
}

/** The largest ladder value ≤ 40% of `amount` (a 60% cut, inside the lecture's 50–80%), at least 1. */
export function relapseSuggestion(amount: number): number {
  const target = amount * 0.4;
  let best = LADDER[0] ?? 1;
  for (const v of LADDER) if (v <= target) best = v;
  return best;
}

function isPositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** Returns an English error message, or `null` when the plan is well-formed. Accepts any input. */
export function validatePlan(plan: unknown): string | null {
  if (typeof plan !== 'object' || plan === null) return 'plan must be an object';
  const p = plan as Record<string, unknown>;
  for (const k of ['id', 'deedSlug', 'title'] as const) {
    if (typeof p[k] !== 'string' || (p[k] as string).length === 0) return `${k} must be a non-empty string`;
  }
  if (p.unit !== 'minutes' && p.unit !== 'count' && p.unit !== 'times') return 'unit must be minutes|count|times';
  if (!isPositive(p.amount)) return 'amount must be a positive number';
  if (p.ceiling !== undefined && !isPositive(p.ceiling)) return 'ceiling must be a positive number';
  if (typeof p.activeDaysPerWeek !== 'number' || !Number.isInteger(p.activeDaysPerWeek) || p.activeDaysPerWeek < 2 || p.activeDaysPerWeek > 7) {
    return 'activeDaysPerWeek must be an integer 2–7';
  }
  if (!Array.isArray(p.slots) || p.slots.length === 0 || !p.slots.every(isValidTime)) {
    return 'slots must be a non-empty array of HH:MM';
  }
  if (!isValidDate(p.createdOn)) return 'createdOn must be YYYY-MM-DD';
  if (!isValidDate(p.amountChangedOn)) return 'amountChangedOn must be YYYY-MM-DD';
  if (typeof p.log !== 'object' || p.log === null || Array.isArray(p.log)) return 'log must be an object';
  for (const [d, v] of Object.entries(p.log)) {
    if (!isValidDate(d) || !isPositive(v)) return 'log entries must map YYYY-MM-DD to a positive number';
  }
  if (p.ebb !== undefined) {
    const e = p.ebb as Record<string, unknown> | null;
    if (typeof e !== 'object' || e === null || !isValidDate(e.since)) return 'ebb.since must be YYYY-MM-DD';
  }
  if (p.season !== undefined) {
    const s = p.season as Record<string, unknown> | null;
    if (typeof s !== 'object' || s === null || !isPositive(s.amount) || !isValidDate(s.until) || !isPositive(s.previous)) {
      return 'season must be {amount>0, until: YYYY-MM-DD, previous>0}';
    }
  }
  return null;
}

function assertPlan(plan: Plan): void {
  const err = validatePlan(plan);
  if (err) throw new RangeError(`Invalid plan: ${err}`);
}

export interface NewPlan {
  id: string;
  deedSlug: string;
  title: string;
  unit: PlanUnit;
  amount: number;
  ceiling?: number;
  activeDaysPerWeek: number;
  slots: LocalTime[];
  createdOn: LocalDate;
}

/** A new plan with an empty log. Throws when a field is invalid. */
export function createPlan(input: NewPlan): Plan {
  const plan: Plan = { ...input, slots: [...input.slots], amountChangedOn: input.createdOn, log: {} };
  if (plan.ceiling === undefined) delete plan.ceiling;
  assertPlan(plan);
  return plan;
}

/** The plan's everyday amount, ignoring a season. */
export function baseAmount(plan: Plan): number {
  return plan.season ? plan.season.previous : plan.amount;
}

/** Ends a season whose `until` has passed: the amount returns to `previous`, with no penalty. */
export function normalize(plan: Plan, today: LocalDate): Plan {
  if (!isValidDate(today)) throw new RangeError('Invalid today');
  const copy: Plan = { ...plan };
  if (plan.season && today > plan.season.until) {
    copy.amount = plan.season.previous;
    delete copy.season;
  }
  return copy;
}

/**
 * The amount asked for on `date`. Ebb wins (a token amount), then an active season, else the base amount.
 * The log is never read: a missed day is never added to the next one.
 */
export function requiredOn(plan: Plan, date: LocalDate): number {
  if (!isValidDate(date)) throw new RangeError('Invalid date');
  const base = baseAmount(plan);
  if (plan.ebb && date >= plan.ebb.since) return Math.min(base, EBB_AMOUNT);
  if (plan.season && date <= plan.season.until) return plan.season.amount;
  return base;
}

/** Adds `amount` to what is logged for `date` (same-day make-up: any amount counts). */
export function logDone(plan: Plan, date: LocalDate, amount: number): Plan {
  if (!isValidDate(date)) throw new RangeError('Invalid date');
  if (!isPositive(amount)) throw new RangeError('amount must be a positive number');
  return { ...plan, log: { ...plan.log, [date]: (plan.log[date] ?? 0) + amount } };
}

/** Prorated number of active days the plan aims for between `from` and `to` (inclusive). May be fractional. */
export function targetDaysIn(plan: Plan, from: LocalDate, to: LocalDate): number {
  const days = diffDays(from, to) + 1;
  if (days <= 0) return 0;
  return (plan.activeDaysPerWeek * days) / 7;
}

/**
 * Share of target days with anything logged, capped at 1. The window is clipped to start no earlier than
 * `createdOn`. An empty window (nothing was asked) counts as 1.
 */
export function adherence(plan: Plan, from: LocalDate, to: LocalDate): number {
  const start = maxDate(from, plan.createdOn);
  const target = targetDaysIn(plan, start, to);
  if (target <= 0) return 1;
  const lo = toDayNumber(start);
  const hi = toDayNumber(to);
  let done = 0;
  for (const [d, v] of Object.entries(plan.log)) {
    if (v > 0 && isValidDate(d)) {
      const n = toDayNumber(d);
      if (n >= lo && n <= hi) done++;
    }
  }
  return Math.min(1, done / target);
}

export type AdherenceBand = 'excellent' | 'good' | 'gentle';

/** Words for the user. There is deliberately no failure band. */
export function adherenceBand(ratio: number, planAgeDays: number): AdherenceBand {
  if (ratio >= 0.75) return 'excellent';
  if (ratio >= 0.5) return 'good';
  if (planAgeDays < EARLY_DAYS && ratio >= 0.4) return 'good';
  return 'gentle';
}

/**
 * True only when the amount has been held for {@link HOLD_DAYS}, adherence over the last {@link HOLD_DAYS} full
 * days (today excluded, it is still in progress) is ≥ 75%, there is no ebb or season, and the plan is below its
 * ceiling and the top of the ladder.
 */
export function canIncrease(plan: Plan, today: LocalDate): boolean {
  if (!isValidDate(today)) throw new RangeError('Invalid today');
  if (plan.ebb || plan.season) return false;
  if (diffDays(plan.amountChangedOn, today) < HOLD_DAYS) return false;
  if (plan.ceiling !== undefined && plan.amount >= plan.ceiling) return false;
  if (nextStep(plan.amount) === null) return false;
  return adherence(plan, addDays(today, -HOLD_DAYS), addDays(today, -1)) >= INCREASE_ADHERENCE;
}

/** One ladder step up (capped at the ceiling). Throws when {@link canIncrease} is false. */
export function increase(plan: Plan, today: LocalDate): Plan {
  if (!canIncrease(plan, today)) throw new Error('Increase not allowed yet');
  const next = nextStep(plan.amount) as number;
  const amount = plan.ceiling !== undefined ? Math.min(next, plan.ceiling) : next;
  return { ...plan, amount, amountChangedOn: today };
}

/**
 * Lowers the everyday amount (e.g. to {@link relapseSuggestion}). Always allowed; restarts the hold period.
 * Throws when `amount` is not lower than the current base amount (use {@link increase} to go up).
 */
export function decreaseTo(plan: Plan, amount: number, today: LocalDate): Plan {
  if (!isValidDate(today)) throw new RangeError('Invalid today');
  if (!isPositive(amount) || amount >= baseAmount(plan)) throw new RangeError('amount must be positive and lower than the current amount');
  if (plan.season) return { ...plan, season: { ...plan.season, previous: amount }, amountChangedOn: today };
  return { ...plan, amount, amountChangedOn: today };
}

export type PlanStatus = 'ok' | 'relapse';

/** 'relapse' when nothing was logged in the last 7 days (today included) and the plan is older than 7 days. */
export function status(plan: Plan, today: LocalDate): PlanStatus {
  if (diffDays(plan.createdOn, today) <= RELAPSE_DAYS) return 'ok';
  const end = toDayNumber(today);
  for (let n = end - RELAPSE_DAYS + 1; n <= end; n++) {
    if ((plan.log[fromDayNumber(n)] ?? 0) > 0) return 'ok';
  }
  return 'relapse';
}

export function startEbb(plan: Plan, since: LocalDate): Plan {
  if (!isValidDate(since)) throw new RangeError('Invalid since');
  return { ...plan, ebb: { since } };
}

export function endEbb(plan: Plan): Plan {
  const copy: Plan = { ...plan };
  delete copy.ebb;
  return copy;
}

/**
 * Starts (or replaces) a season. `amount` becomes the plan amount until `until`; {@link normalize} restores the
 * everyday amount the day after. The hold clock (`amountChangedOn`) is not touched: a season is no penalty.
 */
export function startSeason(plan: Plan, amount: number, until: LocalDate): Plan {
  if (!isPositive(amount)) throw new RangeError('season amount must be a positive number');
  if (!isValidDate(until)) throw new RangeError('Invalid until');
  return { ...plan, amount, season: { amount, until, previous: baseAmount(plan) } };
}

/** Total minutes asked for on `date` by plans whose unit is minutes. */
export function dailyLoad(plans: readonly Plan[], date: LocalDate): number {
  let total = 0;
  for (const p of plans) if (p.unit === 'minutes') total += requiredOn(p, date);
  return total;
}

/**
 * 'over' when the minutes asked for exceed half of the user's free time: nawafil must not eat the day, and
 * obligations come first. With `date`, ebb and season amounts on that day are used; without it, current amounts.
 */
export function loadWarning(plans: readonly Plan[], freeMinutesPerDay: number, date?: LocalDate): 'ok' | 'over' {
  const load =
    date !== undefined
      ? dailyLoad(plans, date)
      : plans.reduce((sum, p) => sum + (p.unit === 'minutes' ? p.amount : 0), 0);
  return load > Math.max(0, freeMinutesPerDay) * LOAD_SHARE ? 'over' : 'ok';
}
