/**
 * Pure pieces of «ورد اليوم» (the daily screen) and «أعمال دورية» on top of practice-core: the rows of today's list
 * with done rows sunk to the bottom, which plans are periodic (their rule is not daily), and the next date of each
 * periodic act (relatives by practice-core `nextDue`, habits by `planAsksOn`). No rule is re-implemented here.
 */

import {
  addDays,
  nextDue,
  planAsksOn,
  requiredOn,
  type HabitItem,
  type LocalDate,
  type Plan,
  type PlanDayOptions,
  type RelativeItem,
  type Rule,
  type Store,
} from '@thekra/practice-core';

/** One row of a day list, with its words ready (titles from the catalog, amounts as the plan screens write them). */
export type AgendaRowModel =
  | { key: string; kind: 'occasion'; title: string; deed: string }
  | { key: string; kind: 'habit'; item: HabitItem; title: string; meta: string }
  | { key: string; kind: 'relative'; item: RelativeItem; title: string; relation: string; meta: string }
  | { key: string; kind: 'program'; done: boolean; meta: string };

/** A task row is done for its day (an occasion is information, never done). */
export function isRowDone(row: AgendaRowModel): boolean {
  switch (row.kind) {
    case 'occasion':
      return false;
    case 'habit':
      return row.item.complete;
    case 'relative':
      return row.item.done;
    case 'program':
      return row.done;
  }
}

export interface TodayGroups {
  /** Today's sunnah occasions: one compact line each, above the list. */
  occasions: Extract<AgendaRowModel, { kind: 'occasion' }>[];
  /** Tasks still open, in practice-core's order (habits, relatives, the generic check-in). */
  open: AgendaRowModel[];
  /** Tasks done today: at the bottom, dimmed. */
  done: AgendaRowModel[];
}

/** Splits a day's rows: occasions apart, then open tasks, then the done ones (each group keeps its order). */
export function groupTodayRows(rows: readonly AgendaRowModel[]): TodayGroups {
  const groups: TodayGroups = { occasions: [], open: [], done: [] };
  for (const row of rows) {
    if (row.kind === 'occasion') groups.occasions.push(row);
    else if (isRowDone(row)) groups.done.push(row);
    else groups.open.push(row);
  }
  return groups;
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
export function nextAskedOn(plan: Plan, from: LocalDate, opts: PlanDayOptions = {}, horizon = NEXT_HORIZON_DAYS): LocalDate | null {
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
 * Every periodic act with its next date, soonest first: relatives (practice-core `nextDue`, so an overdue one is in
 * the past) and non-daily habits (today while today is asked and not done, else the next day asked).
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
