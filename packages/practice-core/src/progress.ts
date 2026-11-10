/**
 * A habit's completion and milestones (owner round 6, C-02b; docs/plan/2026-11-09-owner-round-6.md §2 «العادات»): the
 * percentage of the way to a made habit, and the milestone lines «تعدّيت أصعب فترة», «صنعت العادة» and the suggestion
 * «شارك تطورك مع الصحبة». Keys only; the clients own the words.
 *
 * Rules (from the ladder in `plan.ts`, research notes docs/research/anas-sheikh-akrim/4EkrbmmIlno-analysis.md §4):
 * - **Completion**: kept days (archive days left out, from the restart after a long archive) over
 *   {@link GRADUATION_MIN_DAYS} (66, the age from which «رسخت هذه العادة» may be offered). 100% only once the member
 *   marked the habit «راسخة»; before that it stops at 99%.
 * - **`hardest-passed` «تعدّيت أصعب فترة»**: the first hold of the ladder ({@link HOLD_DAYS}, 28 days: «اثبت على البداية
 *   شهرًا قبل أي زيادة») kept with at least {@link HARDEST_ADHERENCE} (50%, the «جيد» band) of its asked days logged.
 * - **`habit-made` «صنعت العادة»**: the habit was marked «راسخة» (`establishedOn`), offered by `graduationReady`.
 * - **share** «شارك تطورك مع الصحبة»: suggested for {@link SHARE_SUGGEST_DAYS} days after a milestone (the client shows it
 *   only to a member of a circle).
 * - **Per-habit streak**: asked days in a row with something logged that counts (the «قضاء» rule of `streak.ts`), from
 *   the habit's progress start; excused days and days it does not ask pass through; today and a yesterday that can
 *   still be made up never break it.
 *
 * Pure.
 */
import { addDays, diffDays, type LocalDate } from './dates.js';
import { planAsksOn, type PlanDayOptions } from './agenda.js';
import { adherence, GRADUATION_MIN_DAYS, HOLD_DAYS, isEstablished, progressStart, type Plan } from './plan.js';
import { keptDays } from './limits.js';
import { canMakeUp, countsOn, makeUpDeadline } from './streak.js';
import { isExcused, type Store } from './storage.js';

/** Share of the first hold's asked days that must be logged for «تعدّيت أصعب فترة». */
export const HARDEST_ADHERENCE = 0.5;
/** Days after a milestone during which «شارك تطورك مع الصحبة» is suggested. */
export const SHARE_SUGGEST_DAYS = 7;

export type MilestoneKey = 'hardest-passed' | 'habit-made';
export const MILESTONE_KEYS: readonly MilestoneKey[] = ['hardest-passed', 'habit-made'];

export interface Milestone {
  key: MilestoneKey;
  /** The day it was reached. */
  on: LocalDate;
}

export interface HabitCompletion {
  /** Whole percent 0…100. */
  percent: number;
  keptDays: number;
  /** {@link GRADUATION_MIN_DAYS}. */
  targetDays: number;
  established: boolean;
}

export function habitCompletion(plan: Plan, today: LocalDate): HabitCompletion {
  const kept = keptDays(plan, today);
  const established = isEstablished(plan);
  const percent = established ? 100 : Math.min(99, Math.floor((kept / GRADUATION_MIN_DAYS) * 100));
  return { percent, keptDays: kept, targetDays: GRADUATION_MIN_DAYS, established };
}

/** The milestones reached by `today`, in the order they were reached. */
export function habitMilestones(plan: Plan, today: LocalDate): Milestone[] {
  const out: Milestone[] = [];
  const start = progressStart(plan);
  const holdEnd = addDays(start, HOLD_DAYS - 1);
  if (keptDays(plan, today) >= HOLD_DAYS && holdEnd < today && adherence(plan, start, holdEnd) >= HARDEST_ADHERENCE) {
    out.push({ key: 'hardest-passed', on: addDays(holdEnd, 1) });
  }
  if (plan.establishedOn !== undefined && plan.establishedOn >= start && plan.establishedOn <= today) {
    out.push({ key: 'habit-made', on: plan.establishedOn });
  }
  return out.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
}

/** The milestone to celebrate now with «شارك تطورك مع الصحبة» (the latest within {@link SHARE_SUGGEST_DAYS} days), or null. */
export function shareSuggestion(plan: Plan, today: LocalDate): Milestone | null {
  const list = habitMilestones(plan, today);
  const latest = list[list.length - 1];
  return latest && diffDays(latest.on, today) < SHARE_SUGGEST_DAYS ? latest : null;
}

/** The habit's own run of kept asked days up to `today` (see the rules at the top). */
export function habitStreak(
  store: Pick<Store, 'settings'>,
  plan: Plan,
  today: LocalDate,
  opts: PlanDayOptions & { now?: number; deadlineOf?: (date: LocalDate) => number } = {},
): number {
  const start = progressStart(plan);
  const now = opts.now ?? Date.now();
  const deadlineOf = opts.deadlineOf ?? makeUpDeadline;
  let count = 0;
  for (let d = today; d >= start; d = addDays(d, -1)) {
    if (!planAsksOn(plan, d, opts) || isExcused(store, d)) continue;
    if (countsOn(plan, d, deadlineOf)) count++;
    else if (!canMakeUp(d, today, now, deadlineOf)) break;
  }
  return count;
}
