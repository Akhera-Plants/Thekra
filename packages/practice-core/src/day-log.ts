/**
 * Days of a habit as «سجلّي» and the week strip show them (owner round 6, C-01j / C-01r / C-02a / C-02d;
 * docs/plan/2026-11-09-owner-round-6.md §2, §4):
 *
 * - **No empty entries.** A past day a habit asked for is either done or not. Without a log it counts as «لم تتم» once
 *   the day is over; for a short window ({@link UNLOGGED_ASK_DAYS}) the row still asks «هل فعلتها؟» (فعلتها / لم أفعل).
 *   «لم أفعل» is an explicit mark: a corrected 0 (`correctLog`), which syncs like any correction. Marking «فعلتها» late
 *   logs the day (`logForDay`: inside the «قضاء» window it also counts for the streak).
 * - **The week starts on the member's review day** (`HeartPrefs.reviewDay`, Friday by default: the weekly review and the
 *   next week's plan). Past days without logs are «لم تتم» in a calm style (the client's), future days are view-only.
 * - {@link dayDetails}: what a day of «سجلّي» opens (each habit's state, amount and reflection, the day's state, the
 *   «الفرائض» marks and the «قضاء» count). The «تخفّف» part ({@link programDayDetails}) needs the unlocked programs.
 *
 * Pure; the store is never changed (the answer helpers return a new plan).
 */
import { addDays, diffDays, isValidDate, nowIso, weekday, type IsoTime, type LocalDate } from './dates.js';
import { planAsksOn, type PlanDayOptions } from './agenda.js';
import { correctLog, isPausedOn, type Plan } from './plan.js';
import { logForDay } from './streak.js';
import { isExcused, type Store } from './storage.js';
import { dayStateOn, requiredOnDay, type DayStateView } from './day-state.js';
import { reflectionOf, type Reflection } from './reflection.js';
import { fardOn, type FardPrayer, type FardStatus } from './fard.js';
import { QADA_KEYS } from './qada.js';
import { withCustomPeriodic } from './periodic.js';
import { activePrograms, type CheckIn, type SinProgram } from './sin-program.js';
import { DEFAULT_REVIEW_DAY } from './heart.js';

/** Past days (yesterday = 1) a row without a log still asks «هل فعلتها؟». After that it is just «لم تتم». */
export const UNLOGGED_ASK_DAYS = 3;

/**
 * How one habit stands on one day:
 * - `done`: the day's amount (or more) logged; `partial`: something logged, less than asked (it counts as kept);
 * - `open`: today, nothing yet; `ask`: a past day without a log inside the ask window («هل فعلتها؟», counts as «لم تتم»);
 * - `notDone`: a past day without a log, after the window («لم تتم»); `markedNotDone`: the member said «لم أفعل»;
 * - `excused`: «حال يومي» sick/travel (or the old «عذر»); `notAsked`: the plan's rule skips the day;
 * - `archived`: inside its archive time; `beforeStart`: before the plan existed; `future`: after today (view only).
 */
export type DayLogState =
  | 'done'
  | 'partial'
  | 'open'
  | 'ask'
  | 'notDone'
  | 'markedNotDone'
  | 'excused'
  | 'notAsked'
  | 'archived'
  | 'beforeStart'
  | 'future';

/** True for the states that count as «لم تتم». */
export function countsAsNotDone(state: DayLogState): boolean {
  return state === 'ask' || state === 'notDone' || state === 'markedNotDone';
}

export function dayLogState(store: Pick<Store, 'settings' | 'plans'>, plan: Plan, date: LocalDate, today: LocalDate, opts: PlanDayOptions = {}): DayLogState {
  if (!isValidDate(date) || !isValidDate(today)) throw new RangeError('Invalid date');
  if (date > today) return 'future';
  if (date < plan.createdOn) return 'beforeStart';
  if (isPausedOn(plan, date)) return 'archived';
  const done = plan.log[date] ?? 0;
  if (done > 0) return done >= requiredOnDay(store, plan, date) ? 'done' : 'partial';
  if (!planAsksOn(plan, date, opts)) return 'notAsked';
  if (isExcused(store, date)) return 'excused';
  if (date === today) return 'open';
  if (plan.logCorrectedAt?.[date] !== undefined) return 'markedNotDone';
  return diffDays(date, today) <= UNLOGGED_ASK_DAYS ? 'ask' : 'notDone';
}

/** «فعلتها» for a past (or today's) day: logs the day's amount, or `amount`. The «قضاء» window decides if it counts for the streak. */
export function answerDidIt(store: Pick<Store, 'settings' | 'plans'>, plan: Plan, date: LocalDate, today: LocalDate, amount?: number, now: IsoTime = nowIso()): Plan {
  if (date > today) throw new RangeError('A future day cannot be logged');
  const missing = Math.max(0, requiredOnDay(store, plan, date) - (plan.log[date] ?? 0));
  const add = amount ?? missing;
  return add > 0 ? logForDay(plan, date, add, today, now) : plan;
}

/** «لم أفعل»: an explicit «not done» (a corrected 0, synced). Throws for a future day. */
export function answerDidNot(plan: Plan, date: LocalDate, today: LocalDate, now: IsoTime = nowIso()): Plan {
  if (date > today) throw new RangeError('A future day cannot be marked');
  return correctLog(plan, date, 0, now);
}

/** Every row that asks «هل فعلتها؟» now, newest day first: (plan, date). Periodic acts are left out. */
export function pendingAsks(store: Store, today: LocalDate, opts: PlanDayOptions & { isPeriodicAct?: (plan: Plan) => boolean } = {}): { planId: string; date: LocalDate }[] {
  const periodic = withCustomPeriodic(opts.isPeriodicAct);
  const out: { planId: string; date: LocalDate }[] = [];
  for (let i = 1; i <= UNLOGGED_ASK_DAYS; i++) {
    const date = addDays(today, -i);
    for (const plan of store.plans) {
      if (periodic(plan)) continue;
      if (dayLogState(store, plan, date, today, opts) === 'ask') out.push({ planId: plan.id, date });
    }
  }
  return out;
}

// ── The week strip ─────────────────────────────────────────────────────────────────────────────────────────────

/** The first day of the week holding `date`: the latest `reviewDay` (0 = Sunday … 6 = Saturday) on or before it. */
export function weekStart(date: LocalDate, reviewDay: number = DEFAULT_REVIEW_DAY): LocalDate {
  if (!Number.isInteger(reviewDay) || reviewDay < 0 || reviewDay > 6) throw new RangeError('Invalid reviewDay');
  return addDays(date, -((weekday(date) - reviewDay + 7) % 7));
}

/** The seven days of the week holding `date`, starting on the review day. */
export function weekDays(date: LocalDate, reviewDay: number = DEFAULT_REVIEW_DAY): LocalDate[] {
  const start = weekStart(date, reviewDay);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** One day of the strip: `done` (every asked habit kept), `partial`, `notDone` («لم تتم», calm), `open` (today), `excused`, `empty` (nothing asked), `future`. */
export type WeekDayStatus = 'done' | 'partial' | 'notDone' | 'open' | 'excused' | 'empty' | 'future';

export interface WeekStripDay {
  date: LocalDate;
  isToday: boolean;
  status: WeekDayStatus;
  /** Habits asked that day, and kept (done or partial). */
  asked: number;
  kept: number;
  dayState: DayStateView;
}

/**
 * The week strip at the top of «عاداتي» (the week of `date`, from the review day): each day's status over the habits
 * (periodic acts left out). Days after `today` are `future`.
 */
export function weekStrip(
  store: Store,
  date: LocalDate,
  today: LocalDate,
  opts: PlanDayOptions & { reviewDay?: number; isPeriodicAct?: (plan: Plan) => boolean } = {},
): WeekStripDay[] {
  const periodic = withCustomPeriodic(opts.isPeriodicAct);
  const habits = store.plans.filter((p) => !periodic(p));
  return weekDays(date, opts.reviewDay).map((d) => {
    const dayState = dayStateOn(store, d);
    const base = { date: d, isToday: d === today, dayState };
    if (d > today) return { ...base, status: 'future' as const, asked: 0, kept: 0 };
    const states = habits.map((p) => dayLogState(store, p, d, today, opts)).filter((s) => s !== 'notAsked' && s !== 'archived' && s !== 'beforeStart' && s !== 'future');
    const kept = states.filter((s) => s === 'done' || s === 'partial').length;
    const asked = states.length;
    let status: WeekDayStatus;
    if (dayState.excused) status = 'excused';
    else if (asked === 0) status = 'empty';
    else if (kept === asked) status = 'done';
    else if (d === today) status = 'open';
    else status = kept > 0 ? 'partial' : 'notDone';
    return { ...base, status, asked, kept };
  });
}

// ── A day of «سجلّي» ─────────────────────────────────────────────────────────────────────────────────────────

export interface HabitDayDetail {
  planId: string;
  title: string;
  state: DayLogState;
  done: number;
  required: number;
  reflection: Reflection | null;
}

export interface DayDetails {
  date: LocalDate;
  dayState: DayStateView;
  /** Habits and periodic plans that existed that day (not before their start, not after today). */
  habits: HabitDayDetail[];
  /** «الفرائض» marks of the day (all null when none or when off). */
  fard: Record<FardPrayer, FardStatus | null>;
  /** «قضاء الفوائت» made up that day (all keys). */
  qada: number;
}

/** What «سجلّي» shows when a day is opened (week or month). */
export function dayDetails(store: Store, date: LocalDate, today: LocalDate, opts: PlanDayOptions = {}): DayDetails {
  const habits: HabitDayDetail[] = [];
  for (const plan of store.plans) {
    const state = dayLogState(store, plan, date, today, opts);
    if (state === 'beforeStart' || state === 'future') continue;
    habits.push({
      planId: plan.id,
      title: plan.title,
      state,
      done: plan.log[date] ?? 0,
      required: requiredOnDay(store, plan, date),
      reflection: reflectionOf(store, plan.id, date),
    });
  }
  let qada = 0;
  for (const l of store.qadaLogs ?? []) if (l.date === date && QADA_KEYS.includes(l.prayer)) qada += l.count;
  return { date, dayState: dayStateOn(store, date), habits, fard: fardOn(store, date), qada };
}

/** One running program's day (only with the programs unlocked: everything here is vault data). */
export interface ProgramDayDetail {
  sinSlug: string;
  checkIn: CheckIn | null;
}

/** The «تخفّف» part of a day of «سجلّي»: each running program's check-in (note, «ما الذي أعانك / صعّب», chips). */
export function programDayDetails(programs: readonly SinProgram[], date: LocalDate): ProgramDayDetail[] {
  return activePrograms(programs)
    .filter((p) => p.startedOn <= date)
    .map((p) => ({ sinSlug: p.sinSlug, checkIn: p.checkIns.find((c) => c.date === date) ?? null }));
}
