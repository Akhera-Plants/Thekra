/**
 * The app's row models of «ورد اليوم» (words ready) on top of practice-core: today's list grouped by practice-core
 * `groupToday` (occasions apart, done rows sunk to the bottom). The periodic acts (`periodicActs`, `upcomingPeriodic`,
 * `isPeriodicPlan`, `nextAskedOn`) live in practice-core `wird.ts`, shared with the website. No rule is re-implemented here.
 */

import { groupToday, type HabitItem, type RelativeItem } from '@thekra/practice-core';

/** One row of a day list, with its words ready (titles from the catalog, amounts as the plan screens write them). */
export type AgendaRowModel =
  | { key: string; kind: 'occasion'; title: string; deed: string }
  | { key: string; kind: 'habit'; item: HabitItem; title: string; meta: string; canMinimum?: boolean }
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
  return groupToday(rows, (row) => (row.kind === 'occasion' ? 'occasion' : isRowDone(row) ? 'done' : 'open')) as TodayGroups;
}

/** The periodic-act rules live in practice-core (shared with the website); re-exported for the app's imports. */
export {
  isPeriodicPlan,
  NEXT_HORIZON_DAYS,
  nextAskedOn,
  periodicActs,
  planRule,
  upcomingPeriodic,
  type PeriodicAct,
} from '@thekra/practice-core';
