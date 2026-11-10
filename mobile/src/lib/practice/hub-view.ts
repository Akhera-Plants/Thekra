/**
 * Pure models of «عاداتي» after owner round 6 (docs/plan/2026-11-09-owner-round-6.md §2–§6): the five tabs and their
 * `?tab=` param (old links keep working), the groups of «اليوم» (الفرائض · عادات اليوم · الأعمال الدورية) and the
 * time-of-day bands of the habits (بداية / خلال / ختام اليوم), the week strip's marks, the inline counter, the habit
 * list's milestone lines, the archive lines, the «حال يومي» line, the week a day's weekly review covers, and the path
 * «تعلّم من الخطأ» reads in «سجلّي». Every rule comes from practice-core; this file only chooses words and order, so a
 * test can hold each choice. No React here.
 */

import {
  addDays,
  countsAsNotDone,
  dayLogState,
  diffDays,
  isPrayerAnchor,
  reflectionsOfPlan,
  slotChoices,
  weekday,
  type ArchiveNote,
  type DayLogState,
  type DayStateView,
  type LocalDate,
  type LocalTime,
  type Milestone,
  type Plan,
  type PlanDayOptions,
  type PlanUnit,
  type PrayerAnchor,
  type Rule,
  type Store,
  type WeekDayStatus,
} from '@thekra/practice-core';

// ── The tabs of «عاداتي» ────────────────────────────────────────────────────────────────────────────────────────

/** In order. The keys are the `?tab=` values (`/habits?tab=today` …); the nav map names each one (tested). */
export const HABITS_TABS = ['today', 'habits', 'periodic', 'review', 'record'] as const;
export type HabitsTab = (typeof HABITS_TABS)[number];

/** The nav map's feature key of each tab (practice-core `NAV_FEATURES`). */
export const HABITS_TAB_FEATURE: Readonly<Record<HabitsTab, string>> = {
  today: 'today',
  habits: 'my-habits',
  periodic: 'periodic',
  review: 'review',
  record: 'record',
};

/**
 * Old `?tab=` values from earlier builds, notifications and links: «ورد اليوم» is «اليوم» now; the people page and the
 * kinship page are inside «الأعمال الدورية».
 */
const TAB_ALIASES: Readonly<Record<string, HabitsTab>> = { wird: 'today', people: 'periodic', kinship: 'periodic', plan: 'habits' };

/** The tab a link asks for; anything unknown (or none) opens «اليوم». */
export function parseHabitsTab(raw: unknown): HabitsTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return 'today';
  if ((HABITS_TABS as readonly string[]).includes(value)) return value as HabitsTab;
  return TAB_ALIASES[value] ?? 'today';
}

// ── «اليوم»: groups and bands ──────────────────────────────────────────────────────────────────────────────────

/** The groups of «اليوم», chosen by a badge row on phones (no scrolling to reach one), side by side when wide. */
export const TODAY_GROUPS = ['fard', 'habits', 'periodic'] as const;
export type TodayGroup = (typeof TODAY_GROUPS)[number];
/** The group a phone opens on. */
export const DEFAULT_TODAY_GROUP: TodayGroup = 'habits';
/** From this window width the three groups show side by side (tablets, the web build on a wide screen). */
export const SIDE_BY_SIDE_WIDTH = 900;

export type DayBand = 'start' | 'during' | 'end';
export const DAY_BANDS: readonly DayBand[] = ['start', 'during', 'end'];

const ANCHOR_BAND: Readonly<Record<PrayerAnchor, DayBand>> = {
  'after-fajr': 'start',
  'after-dhuhr': 'during',
  'after-asr': 'during',
  'after-maghrib': 'end',
  'after-isha': 'end',
  'before-sleep': 'end',
};

/** A fixed time's band: before 10:00 the start of the day, before 18:00 during it, then its close. */
export function bandOfTime(time: LocalTime): DayBand {
  if (time < '10:00') return 'start';
  if (time < '18:00') return 'during';
  return 'end';
}

/** The band of a habit: its first reminder (a prayer anchor, or a fixed time). */
export function bandOf(plan: Pick<Plan, 'slots' | 'slotAnchors'>): DayBand {
  const first = slotChoices(plan)[0];
  if (first === undefined) return 'during';
  return isPrayerAnchor(first) ? ANCHOR_BAND[first] : bandOfTime(first);
}

/** Splits items into the three bands (each keeps its order); empty bands are left out. */
export function byBand<T>(items: readonly T[], bandOfItem: (item: T) => DayBand): { band: DayBand; items: T[] }[] {
  return DAY_BANDS.map((band) => ({ band, items: items.filter((i) => bandOfItem(i) === band) })).filter((g) => g.items.length > 0);
}

/**
 * The inline counter of the reference («2 / 4 صفحات» and «+»): counted habits (pages, times, a number) asked for more
 * than one unit. A minutes habit is ticked whole (one tap logs what is left).
 */
export function hasCounter(unit: PlanUnit, required: number): boolean {
  return unit !== 'minutes' && required > 1;
}

// ── The week strip ─────────────────────────────────────────────────────────────────────────────────────────────

/** What a day of the strip shows under its number: a filled dot, a ring, the calm words «لم تتم», «عذر», or nothing. */
export type StripMark = 'done' | 'partial' | 'notDone' | 'excused' | 'none';

export function stripMark(status: WeekDayStatus): StripMark {
  switch (status) {
    case 'done':
      return 'done';
    case 'partial':
      return 'partial';
    case 'notDone':
      return 'notDone';
    case 'excused':
      return 'excused';
    default:
      return 'none';
  }
}

/** Past days open their details; today is the page itself; future days are view-only. */
export function stripDayOpens(date: LocalDate, today: LocalDate): boolean {
  return date < today;
}

/** How many weeks back the strip may go (about two months: older days are in «سجلّي»). */
export const STRIP_WEEKS_BACK = 8;

// ── Weekly reviews ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The weekly review that covers `date`: the first review day on or after it (a review closes the seven days ending on
 * its day, practice-core `WeeklyReview.weekOf`).
 */
export function reviewWeekOf(date: LocalDate, reviewDay: number): LocalDate {
  return addDays(date, (reviewDay - weekday(date) + 7) % 7);
}

// ── «حال يومي» ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The gentle line under the day's title on a hard day (the habits; «تخفّف» has its own line), or null. */
export function dayStateLineKey(view: DayStateView): string | null {
  if (view.state === 'normal') return null;
  return 'habitsHub.dayState.forgive';
}

/**
 * The firm and kind line for a running «تخفّف» program on a hard day (never «سامح نفسك» about a sin; generic, it names
 * no sin), as on the website, or null.
 */
export function dayStateLightenKey(view: DayStateView, hasProgram: boolean): string | null {
  return view.state === 'normal' || !hasProgram ? null : 'habitsHub.dayState.lighten';
}

// ── «العادات» ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The milestone lines under a habit (keys from practice-core `habitMilestones`), newest last, then «شارك تطورك مع
 * الصحبة» when practice-core suggests it and the member is in a circle.
 */
export function milestoneLines(milestones: readonly Milestone[], share: Milestone | null, inCircle: boolean): string[] {
  const keys: string[] = milestones.map((m) => (m.key === 'habit-made' ? 'habitsHub.habits.milestoneMade' : 'habitsHub.habits.milestoneHardest'));
  if (share && inCircle) keys.push('habitsHub.habits.share');
  return keys;
}

/** The archive line of an archived habit: whether a restore keeps its progress, and until when. */
export function archiveLine(note: ArchiveNote): { key: string; params: Record<string, string | number> } {
  if (note.resetsIfRestoredToday) return { key: 'habitsHub.archive.willReset', params: { days: note.daysArchived } };
  return { key: 'habitsHub.archive.keeps', params: { date: note.keepsProgressUntil } };
}

/** The toast after a restore (practice-core `restorePlan` says whether the progress started again). */
export function restoreToastKey(reset: boolean): string {
  return reset ? 'habitsHub.archive.restoredReset' : 'habitsHub.archive.restoredKept';
}

// ── «تعلّم من الخطأ» ───────────────────────────────────────────────────────────────────────────────────────────

/** Days the path looks back from a slipped day (that day included). */
export const SLIP_PATH_DAYS = 7;

export interface SlipPath {
  planId: string;
  /** The days before the slip and the slip itself, oldest first, with practice-core's state (only asked days). */
  days: { date: LocalDate; state: DayLogState }[];
  /** «ما الذي صعّب عليك؟» in those days, newest first. */
  hard: { date: LocalDate; text: string }[];
  /** «ما الذي أعانك؟» in those days (what worked before), newest first. */
  helped: { date: LocalDate; text: string }[];
  /** The member's own plan from «حلقة العادة» («ما الذي يعيقك؟», «خطة إن عاق»). */
  obstacle: string | null;
  ifThen: string | null;
  /** Not-done days in a row ending on the slip. */
  run: number;
}

/**
 * The path a habit took to a slipped day: the week before it, what the member wrote was hard or helped, and his own
 * «if … then» plan. Null when the day is not a slip of that habit.
 */
export function slipPath(store: Store, plan: Plan, date: LocalDate, today: LocalDate, opts: PlanDayOptions = {}): SlipPath | null {
  const state = dayLogState(store, plan, date, today, opts);
  if (!countsAsNotDone(state)) return null;
  const from = addDays(date, -(SLIP_PATH_DAYS - 1));
  const days: SlipPath['days'] = [];
  for (let d = from; d <= date; d = addDays(d, 1)) {
    const s = dayLogState(store, plan, d, today, opts);
    if (s === 'notAsked' || s === 'beforeStart' || s === 'archived' || s === 'future') continue;
    days.push({ date: d, state: s });
  }
  let run = 0;
  for (let i = days.length - 1; i >= 0 && countsAsNotDone(days[i]!.state); i--) run++;
  const inWindow = reflectionsOfPlan(store, plan.id).filter((r) => r.date >= from && r.date <= date);
  const loop = plan.loops?.[0];
  return {
    planId: plan.id,
    days,
    hard: inWindow.filter((r) => r.hard).map((r) => ({ date: r.date, text: r.hard as string })),
    helped: inWindow.filter((r) => r.helped).map((r) => ({ date: r.date, text: r.helped as string })),
    obstacle: loop?.obstacle || null,
    ifThen: loop?.ifThen || null,
    run,
  };
}

/** The day's slips: plans whose state on `date` counts as «لم تتم». */
export function slippedPlans(store: Store, date: LocalDate, today: LocalDate, opts: PlanDayOptions & { isPeriodicAct?: (p: Plan) => boolean } = {}): Plan[] {
  return store.plans.filter((p) => !opts.isPeriodicAct?.(p) && countsAsNotDone(dayLogState(store, p, date, today, opts)));
}

// ── Periodic acts ──────────────────────────────────────────────────────────────────────────────────────────────

/** «اليوم», «غدًا», «بعد n أيام», «فات موعده منذ n أيام» as a key and its count. */
export function dueWords(next: LocalDate | null, today: LocalDate): { key: string; count?: number } {
  if (next === null) return { key: 'habitsHub.periodic.noNext' };
  const n = diffDays(today, next);
  if (n < 0) return { key: 'habitsHub.periodic.overdue', count: -n };
  if (n === 0) return { key: 'habitsHub.periodic.today' };
  if (n === 1) return { key: 'habitsHub.periodic.tomorrow' };
  return { key: 'habitsHub.periodic.inDays', count: n };
}

// ── «قضاء الفوائت» ─────────────────────────────────────────────────────────────────────────────────────────────

/** Pace choices (prayers a day) offered as chips; any other number can be typed. */
export const QADA_PACES: readonly number[] = [1, 2, 3, 5, 10];

/** The circle's arc: the share done, clamped to 0…1 (an empty plan reads as 0). */
export function qadaArc(done: number, owed: number): number {
  if (owed <= 0) return 0;
  return Math.max(0, Math.min(1, done / owed));
}

// ── A member's own periodic act ────────────────────────────────────────────────────────────────────────────────

/** The rhythms the «عمل من عندك» form offers (all non-daily, practice-core `isPeriodicRule`). */
export type CustomRhythm = 'weekly' | 'everyNDays' | 'monthly';
export const CUSTOM_RHYTHMS: readonly CustomRhythm[] = ['weekly', 'everyNDays', 'monthly'];

export interface CustomRhythmValues {
  rhythm: CustomRhythm;
  /** Weekdays (weekly), 1…6 of them (all seven would be daily). */
  days: number[];
  /** Every n days, 2…365. */
  n: number;
  /** Day of the month, 1…28 (every month has it). */
  day: number;
}

/** The form's rule, or null when it is not a valid periodic rhythm. */
export function customRule(values: CustomRhythmValues, today: LocalDate): Rule | null {
  if (values.rhythm === 'weekly') {
    const days = [...new Set(values.days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
    return days.length >= 1 && days.length <= 6 ? { kind: 'weekdays', days } : null;
  }
  if (values.rhythm === 'everyNDays') {
    return Number.isInteger(values.n) && values.n >= 2 && values.n <= 365 ? { kind: 'everyNDays', n: values.n, anchor: today } : null;
  }
  return Number.isInteger(values.day) && values.day >= 1 && values.day <= 28 ? { kind: 'monthlyDay', day: values.day } : null;
}

/** The form values of a saved rule (the edit form opens on them); an unknown rule opens as «weekly» on `weekdayToday`. */
export function customRhythmOf(rule: Rule | undefined, weekdayToday: number): CustomRhythmValues {
  const base: CustomRhythmValues = { rhythm: 'weekly', days: [weekdayToday], n: 3, day: 1 };
  if (!rule) return base;
  if (rule.kind === 'weekdays') return { ...base, days: [...rule.days] };
  if (rule.kind === 'everyNDays') return { ...base, rhythm: 'everyNDays', n: rule.n };
  if (rule.kind === 'monthlyDay') return { ...base, rhythm: 'monthly', day: rule.day };
  return base;
}
