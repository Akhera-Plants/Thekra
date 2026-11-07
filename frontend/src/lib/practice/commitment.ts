/**
 * The weekly commitment bars of a habit page (owner round 3, item 9), on top of practice-core `adherence`: the share of
 * a habit's target days with anything logged. «عملك المعتاد يُكتب لك» now comes from practice-core `usualDeedDue`
 * through `heartSlot` (round 5), the same rule as the app. Pure.
 */
import {
  addDays,
  adherence,
  toDayNumber,
  type LocalDate,
  type Plan,
} from '@thekra/practice-core';

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

/** How many achievement lines «تمّ وردك اليوم» rotates through (`practice.celebrate.lines.l1…`). */
export const DAY_DONE_LINES = 6;

/** The achievement line of the day, 1…{@link DAY_DONE_LINES}: the same all day, the next one tomorrow. */
export function dayDoneLine(today: LocalDate, count: number = DAY_DONE_LINES): number {
  return (((toDayNumber(today) % count) + count) % count) + 1;
}
