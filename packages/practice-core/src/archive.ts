/**
 * «الأرشيف» (owner round 6, owner chat + C-01d; docs/plan/2026-11-09-owner-round-6.md §2): ONE concept for «put a habit
 * aside». It IS the old pause («أوقِف مؤقتًا»): the same `pausedOn` / `resumedOn` fields, so every stored pause reads as
 * archived and nothing migrates. There is no second «paused» state in the UI.
 *
 * - At most {@link ARCHIVE_MAX} (10) habits in the archive; beyond that the member must delete one ({@link canArchive};
 *   the server refuses an 11th, sync contract «Round 6»).
 * - Restoring after more than {@link ARCHIVE_RESET_DAYS} (3) days starts the habit's progress again
 *   ({@link restorePlan}: the amount back to its start, the hold, kept days, the per-habit streak and the milestones
 *   count from the restore day). The logged history is never deleted: «سجلّي» still shows it.
 * - The clients say this clearly when archiving ({@link archiveNote}) and in the limit sheet of «أضف»
 *   ({@link habitAddChoice}: «لديك 3 عادات — أرشف واحدة أو احذفها»).
 *
 * Pure; inputs are never mutated.
 */
import { addDays, diffDays, nowIso, type IsoTime, type LocalDate } from './dates.js';
import { ARCHIVE_RESET_DAYS, isPaused, pausePlan, restartProgress, resumePlan, type Plan } from './plan.js';
import { limits, LIMITS, type LimitOptions } from './limits.js';
import { updatePlan, type Store } from './storage.js';

export { ARCHIVE_RESET_DAYS } from './plan.js';

/** Habits kept in the archive at most. */
export const ARCHIVE_MAX = 10;

/** True while the plan is in the archive (the round-5 «paused»). */
export function isArchived(plan: Plan): boolean {
  return isPaused(plan);
}

/** The archived plans, the most recently archived first. */
export function archivedPlans(store: Pick<Store, 'plans'>): Plan[] {
  return store.plans.filter(isArchived).sort((a, b) => ((a.pausedOn as string) < (b.pausedOn as string) ? 1 : -1));
}

/** True when one more habit fits in the archive. */
export function canArchive(store: Pick<Store, 'plans'>): boolean {
  return archivedPlans(store).length < ARCHIVE_MAX;
}

/** What the archive sheet says about one plan on `today`. */
export interface ArchiveNote {
  /** Days in the archive so far (0 on the day it was archived; 0 for a live plan). */
  daysArchived: number;
  /** Restoring today starts the progress again. */
  resetsIfRestoredToday: boolean;
  /** The last day a restore keeps the progress (archive day + 3). */
  keepsProgressUntil: LocalDate;
  resetDays: number;
}

/** For the archive line («إن بقيت في الأرشيف أكثر من 3 أيام يبدأ تقدّمها من جديد»): of an archived plan, or of archiving now. */
export function archiveNote(plan: Plan, today: LocalDate): ArchiveNote {
  const since = isArchived(plan) ? (plan.pausedOn as LocalDate) : today;
  const daysArchived = Math.max(0, diffDays(since, today));
  return {
    daysArchived,
    resetsIfRestoredToday: daysArchived > ARCHIVE_RESET_DAYS,
    keepsProgressUntil: addDays(since, ARCHIVE_RESET_DAYS),
    resetDays: ARCHIVE_RESET_DAYS,
  };
}

/** Puts a plan in the archive on `today`. Throws when the archive is full or the plan is unknown; no-op when archived. */
export function archivePlan(store: Store, planId: string, today: LocalDate, now: IsoTime = nowIso()): Store {
  const plan = store.plans.find((p) => p.id === planId);
  if (!plan) throw new RangeError('Unknown plan');
  if (isArchived(plan)) return store;
  if (!canArchive(store)) throw new RangeError('The archive is full');
  return updatePlan(store, planId, (p) => pausePlan(p, today, now), now);
}

/**
 * Takes a plan out of the archive on `today`. After more than {@link ARCHIVE_RESET_DAYS} days its progress starts
 * again (`restartProgress`); `reset` says which happened. A plan that is not archived comes back unchanged.
 */
export function restorePlan(plan: Plan, today: LocalDate, now: IsoTime = nowIso()): { plan: Plan; reset: boolean } {
  if (!isArchived(plan)) return { plan, reset: false };
  const reset = archiveNote(plan, today).resetsIfRestoredToday;
  const resumed = resumePlan(plan, today, now);
  return { plan: reset ? restartProgress(resumed, today, now) : resumed, reset };
}

/** {@link restorePlan} inside a store. Throws when the plan is unknown. */
export function restorePlanInStore(store: Store, planId: string, today: LocalDate, now: IsoTime = nowIso()): { store: Store; reset: boolean } {
  const plan = store.plans.find((p) => p.id === planId);
  if (!plan) throw new RangeError('Unknown plan');
  const { plan: next, reset } = restorePlan(plan, today, now);
  return { store: next === plan ? store : updatePlan(store, planId, () => next, now), reset };
}

/** «أضف» when the habits are full (C-01d): the two choices, and the plans the member can archive or delete. */
export interface HabitAddChoice {
  /** Young habits counted (3). */
  count: number;
  max: number;
  /** In order: «أرشِف واحدة» (only when the archive has room), then «احذف واحدة». */
  options: ('archive' | 'delete')[];
  /** The habits that hold the places (archive / delete candidates), the one that settles first first. */
  candidates: Plan[];
  /** Archived habits now, and the cap. */
  archived: number;
  archiveMax: number;
  /** The 3-day progress note. */
  resetDays: number;
}

/**
 * Null when a new habit fits; otherwise what the sheet of «أضف» shows («لديك 3 عادات: أرشِف واحدة أو احذفها» + the
 * 3-day note). Uses the same count as `limits` (young habits, periodic acts left out).
 */
export function habitAddChoice(store: Store, today: LocalDate, opts: LimitOptions = {}): HabitAddChoice | null {
  const l = limits(store, today, opts);
  if (l.canAdd('sapling')) return null;
  const archived = archivedPlans(store).length;
  return {
    count: l.sapling.count,
    max: LIMITS.sapling,
    options: archived < ARCHIVE_MAX ? ['archive', 'delete'] : ['delete'],
    candidates: l.saplings,
    archived,
    archiveMax: ARCHIVE_MAX,
    resetDays: ARCHIVE_RESET_DAYS,
  };
}
