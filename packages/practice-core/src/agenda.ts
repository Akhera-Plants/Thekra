/**
 * «عاداتي» today view, shared by the website, the extension and the app: what one day asks for across every track
 * (good habits, صلة الرحم, the sin program, sunnah occasions), and how present the user was on each day.
 *
 * Method (docs/research/anas-sheikh-akrim/4EkrbmmIlno-analysis.md §8): any amount logged counts as a day; there are no
 * streaks and no failure words, so this module exposes presence and the plans' own adherence band, never a run
 * length. The sin program appears only as a generic check-in (roadmap §0.2): no slug ever leaves `programs`.
 */
import { addDays, diffDays, eachDay, type LocalDate } from './dates.js';
import { latestDate, nextDue, type Relative } from './kinship.js';
import { adherence, adherenceBand, requiredOn, type AdherenceBand, type Plan } from './plan.js';
import { isDue, occurrences, type Rule } from './rules.js';
import { activePrograms, type SinProgram } from './sin-program.js';
import type { Store } from './storage.js';

/** A sunnah occasion from the practice catalog (`occasions` of `GET /v1/practice/catalog`). */
export interface AgendaOccasion {
  key: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  rule: Rule;
}

export interface HabitItem {
  kind: 'habit';
  planId: string;
  required: number;
  done: number;
  remaining: number;
  complete: boolean;
}

export interface RelativeItem {
  kind: 'relative';
  relativeId: string;
  /** The contact was logged on this day. */
  done: boolean;
  /** Days past its due date on this day (0 = due this day). */
  overdueDays: number;
}

/** The sin program, generic on purpose: the item says only whether this day has a check-in. */
export interface ProgramItem {
  kind: 'program';
  done: boolean;
}

export interface OccasionItem {
  kind: 'occasion';
  key: string;
  titleAr: string;
  titleEn: string;
  deed: string;
}

export type AgendaItem = HabitItem | RelativeItem | ProgramItem | OccasionItem;

export interface AgendaOptions {
  occasions?: readonly AgendaOccasion[];
  hijriOffset?: number;
}

/** A plan asks for something on `date` unless its own schedule (`rule`) says otherwise; it never asks before it starts. */
function planAsksOn(plan: Plan, date: LocalDate): boolean {
  if (date < plan.createdOn) return false;
  return plan.rule ? isDue(plan.rule, date) : true;
}

function habitItem(plan: Plan, date: LocalDate): HabitItem {
  const required = requiredOn(plan, date);
  const done = plan.log[date] ?? 0;
  const remaining = Math.max(0, required - done);
  return { kind: 'habit', planId: plan.id, required, done, remaining, complete: remaining === 0 };
}

/**
 * A relative belongs to a day when it was contacted that day, or when its next due date (as seen on that day) has
 * arrived: due today, or overdue and still waiting.
 */
function relativeItem(rel: Relative, date: LocalDate): RelativeItem | null {
  if (rel.history.includes(date)) return { kind: 'relative', relativeId: rel.id, done: true, overdueDays: 0 };
  const before = rel.history.filter((d) => d < date);
  const asOfDay: Relative = { ...rel, history: before, lastContactedOn: latestDate(before) };
  const due = nextDue(asOfDay, date);
  if (due > date) return null;
  const overdueDays = diffDays(due, date);
  return { kind: 'relative', relativeId: rel.id, done: false, overdueDays };
}

function programItem(programs: readonly SinProgram[], date: LocalDate): ProgramItem | null {
  const active = activePrograms(programs).filter((p) => p.startedOn <= date);
  if (active.length === 0) return null;
  return { kind: 'program', done: active.some((p) => p.checkIns.some((c) => c.date === date)) };
}

function occasionItems(occasions: readonly AgendaOccasion[], date: LocalDate, hijriOffset: number): OccasionItem[] {
  const out: OccasionItem[] = [];
  for (const o of occasions) {
    try {
      if (occurrences(o.rule, date, date, { hijriOffset }).length === 0) continue;
    } catch {
      // A Hijri rule on a runtime without Umm al-Qura: a wrong date is worse than none.
      continue;
    }
    out.push({ kind: 'occasion', key: o.key, titleAr: o.titleAr, titleEn: o.titleEn, deed: o.deed });
  }
  return out;
}

/**
 * Everything one day asks for, in reading order: sunnah occasions first (they shape the day), then habits, then
 * relatives (overdue first), then the private check-in last. Pure; the store is not changed.
 */
export function dayAgenda(store: Store, date: LocalDate, opts: AgendaOptions = {}): AgendaItem[] {
  const habits = store.plans.filter((p) => planAsksOn(p, date)).map((p) => habitItem(p, date));
  const relatives = store.relatives
    .map((r) => relativeItem(r, date))
    .filter((r): r is RelativeItem => r !== null)
    .sort((a, b) => Number(a.done) - Number(b.done) || b.overdueDays - a.overdueDays);
  const program = programItem(store.programs, date);
  return [
    ...occasionItems(opts.occasions ?? [], date, opts.hijriOffset ?? 0),
    ...habits,
    ...relatives,
    ...(program ? [program] : []),
  ];
}

/** Items of a day that can be done (occasions are information, not tasks). */
export function actionable(items: readonly AgendaItem[]): Exclude<AgendaItem, OccasionItem>[] {
  return items.filter((i): i is Exclude<AgendaItem, OccasionItem> => i.kind !== 'occasion');
}

/** Whether an actionable item is done on its day. */
export function isItemDone(item: Exclude<AgendaItem, OccasionItem>): boolean {
  return item.kind === 'habit' ? item.complete : item.done;
}

export interface DayPresence {
  date: LocalDate;
  /** Something was asked that day (a habit, a due relative or a check-in). */
  asked: boolean;
  /** Anything at all was done that day: any habit amount, a contact or a check-in («أي قدر يُحسب»). */
  present: boolean;
  /** Share of the day's actionable items fully done, 0…1 (1 when nothing was asked). */
  share: number;
}

/** Presence per day from `from` to `to` (inclusive): the week strip and «وين وصلت». Never a run length. */
export function presence(store: Store, from: LocalDate, to: LocalDate): DayPresence[] {
  return eachDay(from, to).map((date) => {
    const items = actionable(dayAgenda(store, date));
    const doneCount = items.filter(isItemDone).length;
    const present =
      store.plans.some((p) => (p.log[date] ?? 0) > 0) ||
      store.relatives.some((r) => r.history.includes(date)) ||
      activePrograms(store.programs).some((p) => p.checkIns.some((c) => c.date === date));
    return { date, asked: items.length > 0, present, share: items.length === 0 ? 1 : doneCount / items.length };
  });
}

export interface MonthSummary {
  /** Days with anything done in the window. */
  presentDays: number;
  /** Mean adherence of the plans over the window (0…1), or null without plans. */
  adherence: number | null;
  /** The kind band of that adherence («ممتاز / جيد / برفق»), or null without plans. */
  band: AdherenceBand | null;
}

/** «وين وصلت»: the last `days` days up to `today`. Plans younger than the window count from their start. */
export function monthSummary(store: Store, today: LocalDate, days = 30): MonthSummary {
  const from = addDays(today, -(days - 1));
  const presentDays = presence(store, from, today).filter((d) => d.present).length;
  const plans = store.plans.filter((p) => p.createdOn <= today);
  if (plans.length === 0) return { presentDays, adherence: null, band: null };
  const mean = plans.reduce((sum, p) => sum + adherence(p, from, today), 0) / plans.length;
  const youngest = Math.min(...plans.map((p) => diffDays(p.createdOn, today)));
  return { presentDays, adherence: mean, band: adherenceBand(mean, youngest) };
}
