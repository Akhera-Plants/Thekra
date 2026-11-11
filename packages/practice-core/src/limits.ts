/**
 * Limits (redesign §3, «القليل الدائم خير من الكثير المنقطع»; owner decisions 2026-11-01), shared by the website, the
 * app and the extension:
 *
 * - **Habits («غِراس», طاعات): at most 3 young habits at a time.** A habit is young until it has been kept
 *   {@link HABIT_SETTLE_DAYS} (90) days: days since `createdOn`, minus the days of its pause. A live, unpaused habit
 *   that is not a periodic act counts while it is young, whether or not it was marked «راسخة»; once it has been kept
 *   90 days it no longer counts, so the member may add another. Equivalently: the cap is 3 + the number of habits kept
 *   90 days or more. Pausing a habit takes it out of the count (its history stays).
 * - **«تخفَّف» programs: at most 3 at a time, and a new one may start only when every running one has lasted
 *   {@link PROGRAM_SETTLE_DAYS} (60) days** (days since its `startedOn`).
 * - **أعمال دورية: 8** (owner round 8, Q9).** Periodic acts are reminders, not habits: live, unpaused plans from a periodic template (the
 *   catalog's `kind: periodic`, passed as {@link LimitOptions.isPeriodicAct}), the member's own acts (always periodic,
 *   `periodic.ts`), plus «صلة الرحم والأحباب» (round 6: ALL people lists together are one act, however many people or
 *   lists it holds). Plans of the same catalog act count once. They never count toward the habits (nor the streak:
 *   pass the same `isPeriodicAct` to the streak functions).
 * - Round 6: a habit restored after more than 3 days in the archive starts again (`Plan.restartedOn`): its kept days
 *   count from the restart.
 *
 * {@link limitBlock} tells the clients why adding is refused and the first day it unlocks by itself. Pure; the store
 * is not changed.
 */
import { addDays, diffDays, maxDate, type LocalDate } from './dates.js';
import { circleOf, type PeopleCircle } from './kinship.js';
import { isEstablished, isPaused, progressStart, type Plan } from './plan.js';
import { activePrograms, type SinProgram } from './sin-program.js';
import { periodicActKeyOf, withCustomPeriodic } from './periodic.js';
import type { Store } from './storage.js';

export type LimitKind = 'sapling' | 'periodic' | 'program';

/** `sapling`: young habits at a time; `periodic`: periodic acts; `program`: running «تخفَّف» programs. */
export const LIMITS: Readonly<Record<LimitKind, number>> = { sapling: 3, periodic: 8, program: 3 };
/** A habit kept this many days (pauses excluded) no longer counts toward {@link LIMITS}.sapling. */
export const HABIT_SETTLE_DAYS = 90;
/** Every running «تخفَّف» program must have lasted this many days before another may start. */
export const PROGRAM_SETTLE_DAYS = 60;

export interface LimitOptions {
  /** True for a plan made from a periodic template (catalog `kind: periodic`). Default: none. */
  isPeriodicAct?: (plan: Plan) => boolean;
}

export interface LimitCount {
  count: number;
  max: number;
  /** Adding one more is refused ({@link limitBlock} says why). For habits and periodic acts: `count >= max`. */
  full: boolean;
}

export interface Limits {
  sapling: LimitCount;
  periodic: LimitCount;
  program: LimitCount;
  /** The young habits counted (pause / delete choices of the limit sheet), the one that settles first first. */
  saplings: Plan[];
  /**
   * Always empty since 2026-11-01: marking a habit «راسخة» no longer frees a place (only 90 kept days do), so the
   * limit sheet does not offer «ثبّت … وابدأ الجديدة». Kept for older client builds.
   */
  graduationReady: Plan[];
  /** Periodic-template plans counted. */
  periodicPlans: Plan[];
  /** People lists in use (each one periodic act). */
  circles: PeopleCircle[];
  /** Running «تخفَّف» programs (not ended). */
  programs: SinProgram[];
  /** Whether one more of `kind` fits. A person added to a list already in use adds no act. */
  canAdd(kind: LimitKind, opts?: { circle?: PeopleCircle }): boolean;
}

/**
 * Days the habit has been kept on `today`: days since `createdOn` minus the days inside its last pause
 * (`[pausedOn, resumedOn)`, or up to today while still paused). 0 before it starts.
 */
export function keptDays(plan: Plan, today: LocalDate): number {
  const start = progressStart(plan);
  const age = diffDays(start, today);
  if (age <= 0) return 0;
  let paused = 0;
  if (plan.pausedOn !== undefined && plan.pausedOn < today && (plan.resumedOn === undefined || plan.resumedOn > start)) {
    const from = maxDate(plan.pausedOn, start);
    const until = plan.resumedOn !== undefined && plan.resumedOn < today ? plan.resumedOn : today;
    paused = Math.max(0, diffDays(from, until));
  }
  return Math.max(0, age - paused);
}

/** True once the habit has been kept {@link HABIT_SETTLE_DAYS} days: it no longer counts toward the 3. */
export function isSettledHabit(plan: Plan, today: LocalDate): boolean {
  return keptDays(plan, today) >= HABIT_SETTLE_DAYS;
}

/** The day a habit stops counting if it is kept every day from now (not paused). */
export function habitSettlesOn(plan: Plan, today: LocalDate): LocalDate {
  return addDays(today, Math.max(0, HABIT_SETTLE_DAYS - keptDays(plan, today)));
}

/** The day a program has lasted {@link PROGRAM_SETTLE_DAYS} days. */
export function programSettlesOn(program: SinProgram): LocalDate {
  return addDays(program.startedOn, PROGRAM_SETTLE_DAYS);
}

/**
 * True for a habit being built («قيد الغرس» in the lists): not established, not paused and not a periodic act.
 * The limit counts {@link countsTowardHabitLimit} instead (young habits, established or not).
 */
export function isSapling(plan: Plan, opts: LimitOptions = {}): boolean {
  return !isEstablished(plan) && !isPaused(plan) && !withCustomPeriodic(opts.isPeriodicAct)(plan);
}

/** True for a live habit that takes one of the 3 places on `today`: unpaused, not periodic, kept under 90 days. */
export function countsTowardHabitLimit(plan: Plan, today: LocalDate, opts: LimitOptions = {}): boolean {
  return !isPaused(plan) && !withCustomPeriodic(opts.isPeriodicAct)(plan) && !isSettledHabit(plan, today);
}

/** The limit a new plan falls under. */
export function limitKindOfPlan(plan: Plan, opts: LimitOptions = {}): LimitKind {
  return withCustomPeriodic(opts.isPeriodicAct)(plan) ? 'periodic' : 'sapling';
}

const count = (n: number, max: number, full = n >= max): LimitCount => ({ count: n, max, full });

/** Acts in use: plans of one catalog act count once, a plan outside the catalog list once each, all people lists once. */
function periodicActCount(plans: readonly Plan[], hasPeople: boolean): number {
  const keys = new Set<string>(plans.map((p) => periodicActKeyOf(p) ?? `plan:${p.id}`));
  if (hasPeople) keys.add('silat');
  return keys.size;
}

export function limits(store: Store, today: LocalDate, opts: LimitOptions = {}): Limits {
  const isPeriodicAct = withCustomPeriodic(opts.isPeriodicAct);
  const saplings = store.plans
    .filter((p) => countsTowardHabitLimit(p, today, opts))
    .sort((a, b) => (habitSettlesOn(a, today) < habitSettlesOn(b, today) ? -1 : habitSettlesOn(a, today) > habitSettlesOn(b, today) ? 1 : 0));
  const periodicPlans = store.plans.filter((p) => !isPaused(p) && isPeriodicAct(p));
  const circles = [...new Set(store.relatives.map(circleOf))];
  const programs = activePrograms(store.programs);
  const programYoung = programs.some((p) => programSettlesOn(p) > today);
  const result: Omit<Limits, 'canAdd'> = {
    sapling: count(saplings.length, LIMITS.sapling),
    periodic: count(periodicActCount(periodicPlans, circles.length > 0), LIMITS.periodic),
    program: count(programs.length, LIMITS.program, programs.length >= LIMITS.program || programYoung),
    saplings,
    graduationReady: [],
    periodicPlans,
    circles,
    programs,
  };
  return {
    ...result,
    canAdd(kind, addOpts = {}) {
      // Round 6: every people list is inside «صلة الرحم والأحباب»: once the act is in use, another person adds no act.
      const silatInUse = circles.length > 0 || periodicPlans.some((p) => periodicActKeyOf(p) === 'silat');
      if (kind === 'periodic' && addOpts.circle !== undefined && silatInUse) return true;
      return !result[kind].full;
    },
  };
}

/** Why adding is refused. */
export type LimitBlockReason =
  /** 3 young habits: wait until one has been kept 90 days, or pause / delete one. */
  | 'habits_young'
  /** 8 periodic acts ({@link LIMITS}.periodic): delete one (they never settle). */
  | 'periodic_full'
  /** 3 running programs: end one (or finish it). */
  | 'programs_full'
  /** A running program has not lasted 60 days yet. */
  | 'programs_young';

export interface LimitBlock {
  kind: LimitKind;
  reason: LimitBlockReason;
  count: number;
  max: number;
  /**
   * The first day adding becomes possible by itself (no pause, delete or end), if the member keeps going; null when
   * only freeing a place helps (periodic acts, 3 programs).
   */
  unlocksOn: LocalDate | null;
  /** What holds the place: plan ids or program slugs, with the day each one stops holding it, soonest first. */
  waitingOn: { id: string; settlesOn: LocalDate }[];
}

/**
 * Why one more of `kind` cannot be added on `today`, or null when it can. For the limit sheet:
 *
 * - `habits_young`: «لديك 3 غراس لم تُكمل ثلاثة أشهر بعد. تستطيع إضافة طاعة جديدة يوم {unlocksOn} حين يُتمّ أحدها
 *   ثلاثة أشهر، أو أوقِف أحدها مؤقتًا.»
 * - `programs_young`: «ابدأ برنامجًا جديدًا حين يُتمّ كل برنامج تعمل عليه شهرين (يوم {unlocksOn}).»
 * - `programs_full`: «تعمل على 3 برامج، وهذا الحد. أنهِ أحدها لتبدأ غيره.»
 * - `periodic_full`: «لديك 8 أعمال دورية، وهذا الحد. احذف أحدها لتضيف غيره.»
 *
 * (The same wording is in docs/plan/2026-10-31-redesign-final.md §3; the clients own the strings.)
 */
export function limitBlock(
  store: Store,
  today: LocalDate,
  kind: LimitKind,
  opts: LimitOptions & { circle?: PeopleCircle } = {},
): LimitBlock | null {
  const l = limits(store, today, opts);
  if (l.canAdd(kind, opts.circle !== undefined ? { circle: opts.circle } : {})) return null;
  const { count: n, max } = l[kind];
  if (kind === 'periodic') return { kind, reason: 'periodic_full', count: n, max, unlocksOn: null, waitingOn: [] };
  if (kind === 'sapling') {
    const waitingOn = l.saplings.map((p) => ({ id: p.id, settlesOn: habitSettlesOn(p, today) }));
    // The count must fall to max − 1: the (n − max + 1)-th habit to settle opens the place.
    const opening = waitingOn[n - max];
    return { kind, reason: 'habits_young', count: n, max, unlocksOn: opening?.settlesOn ?? null, waitingOn };
  }
  const waitingOn = l.programs
    .map((p) => ({ id: p.sinSlug, settlesOn: programSettlesOn(p) }))
    .filter((w) => w.settlesOn > today)
    .sort((a, b) => (a.settlesOn < b.settlesOn ? -1 : a.settlesOn > b.settlesOn ? 1 : 0));
  if (n >= max) return { kind, reason: 'programs_full', count: n, max, unlocksOn: null, waitingOn };
  return { kind, reason: 'programs_young', count: n, max, unlocksOn: waitingOn[waitingOn.length - 1]?.settlesOn ?? null, waitingOn };
}
