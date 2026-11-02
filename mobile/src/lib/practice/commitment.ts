/**
 * Commitment rates (owner round 3, items 8 and 9), pure:
 * - «نسبة الالتزام» per habit in «عاداتي» › «الإحصاء»: the share of the habit's asked days with anything logged over
 *   the last {@link COMMITMENT_DAYS} full days (today is still open, so it is left out), practice-core `adherence`.
 *   A habit younger than the window counts from its first day; a habit started today has no rate yet.
 * - «عملك المعتاد يُكتب لك» (the hadith on sickness and travel): never right after «يومي ثقيل» or «عذر» is tapped. It
 *   shows the day after an excused or lightened day, and only when the member's commitment over the period before that
 *   day is above {@link USUAL_DEED_THRESHOLD} (60%).
 */

import { addDays, adherence, isEbbOn, isExcused, isPaused, type LocalDate, type Plan, type Store } from '@thekra/practice-core';

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

/** The rate of one plan over the `days` full days before `today` (null when the plan started today or later). */
export function planCommitment(plan: Plan, today: LocalDate, days = COMMITMENT_DAYS): number | null {
  const to = addDays(today, -1);
  if (plan.createdOn > to) return null;
  return adherence(plan, addDays(today, -days), to);
}

/**
 * Each live habit's rate, in the store's order. Paused habits and periodic acts (reminders, not habits; pass
 * `isPeriodicAct`) are left out.
 */
export function commitmentRates(
  store: Store,
  today: LocalDate,
  opts: { isPeriodicAct?: (plan: Plan) => boolean; days?: number } = {},
): CommitmentRate[] {
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

/** The 60% rule itself: a day with an excuse has passed and the commitment before it is above the threshold. */
export function usualDeedShown(excusedDayPassed: boolean, rate: number | null): boolean {
  return excusedDayPassed && rate !== null && rate > USUAL_DEED_THRESHOLD;
}

/** Yesterday was marked «عذر» or «يومي ثقيل». */
export function yesterdayExcused(store: Store, today: LocalDate): boolean {
  const yesterday = addDays(today, -1);
  return isExcused(store, yesterday) || store.plans.some((p) => isEbbOn(p, yesterday));
}

/**
 * Whether «ورد اليوم» shows «عملك المعتاد يُكتب لك» today: yesterday had an excuse, and the habits' mean commitment over
 * the {@link COMMITMENT_DAYS} days before yesterday is above 60%.
 */
export function showUsualDeed(store: Store, today: LocalDate, opts: { isPeriodicAct?: (plan: Plan) => boolean } = {}): boolean {
  if (!yesterdayExcused(store, today)) return false;
  const before = addDays(today, -1);
  return usualDeedShown(true, meanCommitment(commitmentRates(store, before, opts)));
}
