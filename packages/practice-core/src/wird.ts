/**
 * «ورد اليوم» (the daily screen) and «أعمال دورية», shared by the website and the app: how one day's list is grouped
 * (occasions apart, open tasks, done tasks sunk to the bottom), the habit rows of plans the day does not ask for, how
 * much is left today, which plans are periodic (their rule is not daily) and the next date of each periodic act
 * (relatives by {@link nextDue}, habits by {@link planAsksOn}). Pure; the store is never changed.
 */
import { addDays, type LocalDate } from './dates.js';
import {
  actionable,
  isItemDone,
  plansNotAskedOn,
  planAsksOn,
  type AgendaItem,
  type HabitItem,
  type PlanDayOptions,
} from './agenda.js';
import { nextDue } from './kinship.js';
import { requiredOn, type Plan } from './plan.js';
import type { Rule } from './rules.js';
import type { Store } from './storage.js';

/** Where one row of a day's list goes. */
export type TodayGroup = 'occasion' | 'open' | 'done';

export interface TodayGroups<T> {
  /** Today's sunnah occasions: one compact line each, above the list. */
  occasions: T[];
  /** Tasks still open, in the agenda's order (habits, relatives, the generic check-in). */
  open: T[];
  /** Tasks done that day: at the bottom, dimmed. */
  done: T[];
}

/**
 * Splits a day's rows by `groupOf`: occasions apart, then open tasks, then the done ones; each group keeps its order.
 * Generic so each client can group its own row models (words ready) the same way.
 */
export function groupToday<T>(rows: readonly T[], groupOf: (row: T) => TodayGroup): TodayGroups<T> {
  const groups: TodayGroups<T> = { occasions: [], open: [], done: [] };
  for (const row of rows) {
    const group = groupOf(row);
    if (group === 'occasion') groups.occasions.push(row);
    else if (group === 'done') groups.done.push(row);
    else groups.open.push(row);
  }
  return groups;
}

/** The group of an agenda item: an occasion is information, never done; a task is open until done. */
export function agendaGroup(item: AgendaItem): TodayGroup {
  if (item.kind === 'occasion') return 'occasion';
  return isItemDone(item) ? 'done' : 'open';
}

/** {@link groupToday} over practice-core agenda items. */
export function groupAgenda(items: readonly AgendaItem[]): TodayGroups<AgendaItem> {
  return groupToday(items, agendaGroup);
}

/** How many of the day's tasks are still open («بقي عليك اليوم n»). Occasions are not tasks. */
export function remainingCount(items: readonly AgendaItem[]): number {
  return actionable(items).filter((item) => !isItemDone(item)).length;
}

/**
 * The habit rows of plans that exist on `date` but do not ask for it («ليست مطلوبة اليوم»), with their usual amount,
 * so a tick logs them like any other day. Never counted as missed.
 */
export function offDayItems(store: Store, date: LocalDate, opts: PlanDayOptions = {}): HabitItem[] {
  return plansNotAskedOn(store, date, opts).map((plan) => {
    const required = requiredOn(plan, date);
    const done = plan.log[date] ?? 0;
    const remaining = Math.max(0, required - done);
    return { kind: 'habit', planId: plan.id, required, done, remaining, complete: remaining === 0 };
  });
}

/** The rule a plan follows: its own, else the catalog habit's default; none means every day. */
export function planRule(plan: Plan, opts: PlanDayOptions = {}): Rule | undefined {
  return plan.rule ?? opts.defaultRuleOf?.(plan);
}

/** A plan whose rule is not every day (weekly sadaqah, Friday night prayer…) is a periodic act. */
export function isPeriodicPlan(plan: Plan, opts: PlanDayOptions = {}): boolean {
  const rule = planRule(plan, opts);
  if (!rule || rule.kind === 'daily') return false;
  if (rule.kind === 'weekdays') return new Set(rule.days).size < 7;
  if (rule.kind === 'everyNDays') return rule.n > 1;
  return true;
}

/** How far ahead a next date is looked for (a yearly Hijri rule fits). */
export const NEXT_HORIZON_DAYS = 400;

/** The first day from `from` on that the plan asks for, or null within the horizon. */
export function nextAskedOn(
  plan: Plan,
  from: LocalDate,
  opts: PlanDayOptions = {},
  horizon = NEXT_HORIZON_DAYS,
): LocalDate | null {
  for (let i = 0; i < horizon; i++) {
    const d = addDays(from, i);
    if (planAsksOn(plan, d, opts)) return d;
  }
  return null;
}

/** A periodic act and its next date (null: none within the horizon). */
export type PeriodicAct =
  | { kind: 'relative'; id: string; next: LocalDate }
  | { kind: 'habit'; id: string; next: LocalDate | null };

/**
 * Every periodic act with its next date, soonest first: relatives ({@link nextDue}, so an overdue one is in the past)
 * and non-daily habits (today while today is asked and not done, else the next day asked).
 */
export function periodicActs(store: Store, today: LocalDate, opts: PlanDayOptions = {}): PeriodicAct[] {
  const acts: PeriodicAct[] = store.relatives.map((r) => ({ kind: 'relative' as const, id: r.id, next: nextDue(r, today) }));
  for (const plan of store.plans) {
    if (!isPeriodicPlan(plan, opts)) continue;
    const openToday = planAsksOn(plan, today, opts) && (plan.log[today] ?? 0) < requiredOn(plan, today);
    acts.push({ kind: 'habit', id: plan.id, next: openToday ? today : nextAskedOn(plan, addDays(today, 1), opts) });
  }
  return acts
    .map((act, i) => ({ act, i }))
    .sort((a, b) => {
      const x = a.act.next ?? '9999-12-31';
      const y = b.act.next ?? '9999-12-31';
      return x < y ? -1 : x > y ? 1 : a.i - b.i;
    })
    .map(({ act }) => act);
}

/** The rows still ahead (after today; what is due now is already in today's list), at most `limit`. */
export function upcomingPeriodic<T extends { act: PeriodicAct }>(rows: readonly T[], today: LocalDate, limit = 3): T[] {
  return rows.filter((r) => r.act.next !== null && r.act.next > today).slice(0, limit);
}
