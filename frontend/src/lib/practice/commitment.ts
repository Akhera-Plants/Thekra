/**
 * Commitment rates for «عاداتي» › «التقدّم» (owner round 3, item 9) and the condition of «عملك المعتاد يُكتب لك»
 * (item 8), on top of practice-core `adherence`: the share of a habit's target days with anything logged. Pure.
 */
import {
  addDays,
  adherence,
  isExcused,
  isPaused,
  toDayNumber,
  type LocalDate,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import { isEbbDay } from './plans';

/** One bar of the chart: a seven-day window ending on `to`; `ratio` is null before the habit existed. */
export interface CommitmentBar {
  from: LocalDate;
  to: LocalDate;
  /** 0…1, or null when the whole window is before the habit's first day. */
  ratio: number | null;
}

/** Bars in the commitment chart (eight weeks). */
export const COMMITMENT_WEEKS = 8;

/** The habit's weekly commitment, oldest first, the last window ending today. */
export function weeklyCommitment(plan: Plan, today: LocalDate, weeks: number = COMMITMENT_WEEKS): CommitmentBar[] {
  const bars: CommitmentBar[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const to = addDays(today, -7 * i);
    const from = addDays(to, -6);
    bars.push({ from, to, ratio: to < plan.createdOn ? null : adherence(plan, from, to) });
  }
  return bars;
}

/** Days the overall commitment looks back over (the days before today). */
export const COMMITMENT_PERIOD_DAYS = 30;
/** Above this share, a passed heavy or excused day shows «عملك المعتاد يُكتب لك». */
export const USUAL_DEED_THRESHOLD = 0.6;

/**
 * The member's commitment over the {@link COMMITMENT_PERIOD_DAYS} days before today: the mean adherence of the habits
 * (not paused, not periodic acts) that existed before today. Null without such a habit.
 */
export function periodCommitment(
  store: Store,
  today: LocalDate,
  opts: { isPeriodicAct?: (plan: Plan) => boolean } = {},
): number | null {
  const to = addDays(today, -1);
  const from = addDays(today, -COMMITMENT_PERIOD_DAYS);
  const plans = store.plans.filter((p) => !isPaused(p) && !(opts.isPeriodicAct?.(p) ?? false) && p.createdOn <= to);
  if (plans.length === 0) return null;
  return plans.reduce((sum, p) => sum + adherence(p, from, to), 0) / plans.length;
}

/**
 * «عملك المعتاد يُكتب لك» (the hadith on sickness and travel): only once such a day has passed — yesterday was a
 * heavy day or an excused day — and the commitment over the period is above {@link USUAL_DEED_THRESHOLD}. Never right
 * after tapping «يومي ثقيل».
 */
export function showUsualDeedStory(
  store: Store,
  today: LocalDate,
  opts: { isPeriodicAct?: (plan: Plan) => boolean } = {},
): boolean {
  const yesterday = addDays(today, -1);
  if (!isExcused(store, yesterday) && !isEbbDay(store.plans, yesterday)) return false;
  const rate = periodCommitment(store, today, opts);
  return rate !== null && rate > USUAL_DEED_THRESHOLD;
}

/** How many achievement lines «تمّ وردك اليوم» rotates through (`practice.celebrate.lines.l1…`). */
export const DAY_DONE_LINES = 6;

/** The achievement line of the day, 1…{@link DAY_DONE_LINES}: the same all day, the next one tomorrow. */
export function dayDoneLine(today: LocalDate, count: number = DAY_DONE_LINES): number {
  return (((toDayNumber(today) % count) + count) % count) + 1;
}
