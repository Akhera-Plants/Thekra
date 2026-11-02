/**
 * «لحظة مجاهدة» (owner round 3, item 15), pure parts:
 * - the rotating verse passage (catalog `mujahada.verses`: each passage is 1–3 verse ids read together), a new one
 *   each day and then every two minutes while the timer runs (practice-core `urgeTextIndex`);
 * - the tasbih arithmetic: each «سبحان الله» is a good deed, written ten times up to seven hundred times, if Allah
 *   accepts it (the hadith `mujahada.multiplierHadith`, al-Bukhari 6491, read by id);
 * - «وردك الأدنى»: today's habits that are still open, each with a smaller amount to log now (practice-core
 *   `minimumToLog`, else what is left), and whether it is a prayer (the sitting-prayer hadith, half the reward).
 * The words live in the i18n files (`sinProgram.moment.*`); religious text only by id from the API.
 */

import { minimumToLog, urgeTextIndex, type HabitItem, type LocalDate, type Plan } from '@thekra/practice-core';
import type { CatalogHabit } from './catalog-types';
import { habitFor } from './reminders';

export type { MujahadaCatalog } from './catalog-types';

/** The verse passage to show, or null when the catalog has none. */
export function mujahadaPassage(verses: readonly (readonly string[])[] | undefined, today: LocalDate, elapsedSeconds: number): readonly string[] | null {
  const list = (verses ?? []).filter((p) => p.length > 0);
  const index = urgeTextIndex(list.length, today, elapsedSeconds);
  return index >= 0 ? list[index]! : null;
}

/** The lowest and highest reward of the hadith: each deed ten times, up to seven hundred times. */
export const REWARD_MIN = 10;
export const REWARD_MAX = 700;

export function tasbihReward(count: number): { count: number; min: number; max: number } {
  const n = Math.max(0, Math.floor(count));
  return { count: n, min: n * REWARD_MIN, max: n * REWARD_MAX };
}

/** A soft haptic at each full round of 33 (the usual count of the tasbih after the prayer). */
export const TASBIH_ROUND = 33;
export function isTasbihRound(count: number): boolean {
  return count > 0 && count % TASBIH_ROUND === 0;
}

/** One open habit of today with the smaller amount «سجّل القليل» logs. */
export interface MinimumRow {
  planId: string;
  plan: Plan;
  habit: CatalogHabit | undefined;
  /** What one tap adds to today's log. */
  amount: number;
  /** A prayer habit (the catalog counts it in rak'ahs): offer the sitting nafl prayer too. */
  prayer: boolean;
}

/**
 * Today's open habits (asked today and not complete), each with the amount to log now: the habit's minimum when it is
 * smaller than what is asked, else what is left. Nothing for a complete habit.
 */
export function minimumRows(items: readonly HabitItem[], plans: readonly Plan[], habits: readonly CatalogHabit[], date: LocalDate): MinimumRow[] {
  const rows: MinimumRow[] = [];
  for (const item of items) {
    if (item.complete) continue;
    const plan = plans.find((p) => p.id === item.planId);
    if (!plan) continue;
    const amount = minimumToLog(plan, date) ?? item.remaining;
    if (amount <= 0) continue;
    const habit = habitFor(plan, habits);
    rows.push({ planId: plan.id, plan, habit, amount, prayer: habit?.rakah !== undefined });
  }
  return rows;
}
