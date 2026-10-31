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

/** Where a periodic act opens: a relative on the kinship page (add and edit live there), a habit on its plan card. */
export function periodicHref(act: PeriodicAct): string {
  return act.kind === 'relative' ? '/practice/kinship' : `/practice/habits#plan-${act.id}`;
}
