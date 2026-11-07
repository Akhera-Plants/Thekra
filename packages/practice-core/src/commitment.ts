/**
 * Commitment rates (owner round 3, items 8 and 9) and the condition of «عملك المعتاد يُكتب لك», moved here from the
 * clients in round 5 so the web and the app decide the same way (F-35 a, A-01 a). Pure.
 *
 * - «نسبة الالتزام» per habit: the share of the habit's asked days with anything logged over the
 *   {@link COMMITMENT_DAYS} full days before a day (that day is still open, so it is left out): `adherence`. A habit
 *   younger than the window counts from its first day; a habit started that day has no rate yet.
 * - «عملك المعتاد يُكتب لك» (the hadith on sickness and travel): never right after «يومي ثقيل» or «عذر» is tapped. It
 *   is due the day after an excused or heavy day, and only when the member's mean commitment over the
 *   {@link COMMITMENT_DAYS} days before that excused day is above {@link USUAL_DEED_THRESHOLD} (60%).
 *
 * The two clients had drifted before the move: the app measured the 30 days before the excused day and counted a
 * heavy day when any habit was lightened; the web measured the 30 days before today (the excused day included) and
 * needed every habit lightened. Core keeps the app's rule, which matches the owner's words («over the period» before
 * the excused day; a heavy day is lightened habits).
 */
import { addDays } from './dates.js';
import { adherence, isEbbOn, isPaused, type Plan } from './plan.js';
import { isExcused, type Store } from './storage.js';
import type { LocalDate } from './dates.js';

export const COMMITMENT_DAYS = 30;
/** «عملك المعتاد يُكتب لك» needs a commitment above this share. */
export const USUAL_DEED_THRESHOLD = 0.6;

export interface CommitmentRate {
  planId: string;
  /** 0…1 */
  rate: number;
  /** Whole percent, 0…100 (Western digits on screen). */
  percent: number;
}

export interface CommitmentOptions {
  /** True for a periodic act (a reminder, not a habit): left out. */
  isPeriodicAct?: (plan: Plan) => boolean;
  days?: number;
}

/** The rate of one plan over the `days` full days before `today` (null when the plan started today or later). */
export function planCommitment(plan: Plan, today: LocalDate, days = COMMITMENT_DAYS): number | null {
  const to = addDays(today, -1);
  if (plan.createdOn > to) return null;
  return adherence(plan, addDays(today, -days), to);
}

/** Each live habit's rate, in the store's order. Paused habits and periodic acts are left out. */
export function commitmentRates(store: Pick<Store, 'plans'>, today: LocalDate, opts: CommitmentOptions = {}): CommitmentRate[] {
  const rows: CommitmentRate[] = [];
  for (const plan of store.plans) {
    if (isPaused(plan) || opts.isPeriodicAct?.(plan)) continue;
    const rate = planCommitment(plan, today, opts.days);
    if (rate === null) continue;
    rows.push({ planId: plan.id, rate, percent: Math.round(rate * 100) });
  }
  return rows;
}

/** The mean of the rates, or null without any. */
export function meanCommitment(rates: readonly CommitmentRate[]): number | null {
  if (rates.length === 0) return null;
  return rates.reduce((sum, r) => sum + r.rate, 0) / rates.length;
}

/** Why the day before `today` counts as excused: «عذر» (sick or travelling), or a heavy day (a habit lightened). */
export function excuseOfYesterday(store: Pick<Store, 'plans' | 'settings'>, today: LocalDate): 'excused' | 'heavy' | null {
  const yesterday = addDays(today, -1);
  if (isExcused(store, yesterday)) return 'excused';
  return store.plans.some((p) => isEbbOn(p, yesterday)) ? 'heavy' : null;
}

/**
 * «عملك المعتاد يُكتب لك» is due today: yesterday had an excuse ({@link excuseOfYesterday}) and the habits' mean
 * commitment over the {@link COMMITMENT_DAYS} days before yesterday is above {@link USUAL_DEED_THRESHOLD}.
 */
export function usualDeedDue(store: Pick<Store, 'plans' | 'settings'>, today: LocalDate, opts: CommitmentOptions = {}): boolean {
  if (excuseOfYesterday(store, today) === null) return false;
  const rate = meanCommitment(commitmentRates(store, addDays(today, -1), opts));
  return rate !== null && rate > USUAL_DEED_THRESHOLD;
}
