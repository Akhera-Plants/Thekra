/**
 * View-model of «ورد اليوم», «سجلّي», «أعمال دورية» and the home card, on top of practice-core (`dayAgenda`,
 * `groupAgenda`, `offDayItems`, `remainingCount`, `currentStreak` / `longestStreak`, `periodicActs`). The rules live in
 * practice-core, shared with the app; this file only puts a day's pieces together for the pages and names the link of
 * each periodic act.
 */
import {
  currentStreak,
  dayAgenda,
  groupAgenda,
  longestStreak,
  offDayItems,
  periodicActs,
  remainingCount,
  streakDisplay,
  type AgendaItem,
  type AgendaOptions,
  type HabitItem,
  type LocalDate,
  type OccasionItem,
  type PeriodicAct,
  type PlanDayOptions,
  type Store,
  type StreakDisplay,
} from '@thekra/practice-core';
import type { PracticeHabit } from '@/lib/types/practice';
import { limitOptions } from './limits';

/** A task row of the day (an occasion is information, not a task). */
export type TaskItem = Exclude<AgendaItem, OccasionItem>;

export interface WirdDay {
  /** The day's sunnah occasions: one compact line each. */
  occasions: OccasionItem[];
  /** Tasks still open (habits asked that day, relatives due, the generic check-in), in practice-core's order. */
  open: TaskItem[];
  /** Tasks done that day: sunk to the bottom, dimmed. */
  done: TaskItem[];
  /** Habits the day does not ask for: behind one collapsed «ليست مطلوبة اليوم (n)», still loggable. */
  offDay: HabitItem[];
}

/** Everything one day's list shows, already grouped. */
export function wirdDay(store: Store, date: LocalDate, opts: AgendaOptions = {}): WirdDay {
  const groups = groupAgenda(dayAgenda(store, date, opts));
  return {
    occasions: groups.occasions.filter((item): item is OccasionItem => item.kind === 'occasion'),
    open: groups.open.filter((item): item is TaskItem => item.kind !== 'occasion'),
    done: groups.done.filter((item): item is TaskItem => item.kind !== 'occasion'),
    offDay: offDayItems(store, date, opts),
  };
}

/**
 * «ورد اليوم» in two lists (round 5, F-06 a / F-14 a): the habits of the day (and the generic check-in), and the
 * periodic acts due today or overdue (people due, plans of a periodic template). Off-day rows are habits only.
 */
export function splitWirdDay(day: WirdDay, isPeriodicPlan: (planId: string) => boolean): { habits: WirdDay; periodic: WirdDay } {
  const periodic = (item: TaskItem) => item.kind === 'relative' || (item.kind === 'habit' && isPeriodicPlan(item.planId));
  return {
    habits: {
      occasions: day.occasions,
      open: day.open.filter((item) => !periodic(item)),
      done: day.done.filter((item) => !periodic(item)),
      offDay: day.offDay.filter((item) => !isPeriodicPlan(item.planId)),
    },
    periodic: { occasions: [], open: day.open.filter(periodic), done: day.done.filter(periodic), offDay: [] },
  };
}

export interface WirdSummary {
  /** Tasks of today still open («بقي عليك اليوم n»). */
  remaining: number;
  /** Complete days in a row up to today (today only once complete). */
  streak: number;
  longest: number;
  /** How to show it: never 0 as a failure («ابدأ مداومة جديدة اليوم · أطول مداومة: N»). */
  display: StreakDisplay;
  hasPlans: boolean;
}

/** The numbers of the streak chip, «سجلّي» and the home card. */
export function wirdSummary(store: Store, today: LocalDate, opts: PlanDayOptions = {}): WirdSummary {
  const streak = currentStreak(store, today, opts);
  const longest = longestStreak(store, today, opts);
  return {
    remaining: remainingCount(dayAgenda(store, today, opts)),
    streak,
    longest,
    display: streakDisplay(streak, longest),
    hasPlans: store.plans.length > 0,
  };
}

/** Where a periodic act opens: a relative on «أهلي وناسي» (add and edit live there), a plan on its habit page. */
export function periodicHref(act: PeriodicAct): string {
  return act.kind === 'relative' ? '/practice/people' : `/practice/habits/${act.id}`;
}

/**
 * «أعمال دورية» (owner round 3, item 6): the people lists and the plans made from a periodic template only. A habit
 * is never listed here, even on a weekly rule (it stays in the habits' own sections); nearest first.
 */
export function periodicActsOnly(
  store: Store,
  today: LocalDate,
  opts: PlanDayOptions,
  habits: ReadonlyMap<string, PracticeHabit>,
): PeriodicAct[] {
  const { isPeriodicAct } = limitOptions(habits);
  const plans = new Map(store.plans.map((p) => [p.id, p]));
  return periodicActs(store, today, opts).filter((act) => {
    if (act.kind === 'relative') return true;
    const plan = plans.get(act.id);
    return plan !== undefined && (isPeriodicAct?.(plan) ?? false);
  });
}
