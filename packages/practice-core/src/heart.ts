/**
 * «المقامات الستة» (redesign §4.4): المشارطة («نية اليوم»), المراقبة (one rotating text), المحاسبة (evening and Friday),
 * المعاقبة («التزام شخصي», opt-in, never called a penalty), المجاهدة («أقل ما يمكن») and المعاتبة («رسالة إلى نفسي»).
 *
 * Everything here is private and device-local: {@link HeartData} is kept by each client beside its store (never in the
 * synced `Store`, never sent to the server). Only the step chosen in a Friday review touches a plan (through the usual
 * `increase` / `decreaseTo`), because the plan's amount is synced anyway.
 *
 * Wording rules for the clients: calm, no guilt, no points or comparisons; a pledge is the user's own word to himself,
 * never «عقوبة». Pure; inputs are never mutated.
 */
import { addDays, diffDays, isIsoTime, isValidDate, isValidTime, nowIso, toDayNumber, weekday, type IsoTime, type LocalDate, type LocalTime } from './dates.js';
import { planAsksOn, type PlanDayOptions } from './agenda.js';
import { baseAmount, canIncrease, decreaseTo, increase, isPaused, LADDER, minimumOf, requiredOn, type Plan } from './plan.js';
import { canMakeUp, logForDay, makeUpDeadline } from './streak.js';
import { isExcused, type Store } from './storage.js';

export const HEART_VERSION = 1;
/** «عهد اليوم», «رسالة إلى نفسي» and a pledge's own text: one line. */
export const HEART_LINE_MAX = 140;
/** Days of intentions and evening reviews kept on the device. */
export const HEART_DAYS_KEPT = 60;
/** Weekly reviews kept (two years of Fridays). */
export const WEEKLY_KEPT = 104;
export const MAX_PLEDGES = 20;
/** «نية اليوم» is offered until this time. */
export const INTENTION_UNTIL: LocalTime = '12:00';
/** The evening review appears from this time unless the user chose another ({@link HeartPrefs}.eveningFrom). */
export const EVENING_FROM: LocalTime = '19:00';
/** The weekly review's default day (0 = Sunday … 6 = Saturday): Friday. */
export const DEFAULT_REVIEW_DAY = 5;
/** A weekly review skipped on its day is still offered the next day until this time. */
export const NEXT_DAY_UNTIL: LocalTime = '12:00';
/** @deprecated The weekly review's day is the user's choice now; use {@link NEXT_DAY_UNTIL}. */
export const SATURDAY_UNTIL: LocalTime = NEXT_DAY_UNTIL;
/** How far back a pledge looks for two missed days in a row. */
export const PLEDGE_LOOKBACK_DAYS = 14;

/** The switches of «نية اليوم» and «المحاسبة». */
export interface HeartPrefs {
  /** «نية اليوم»: opt-in. */
  intention: boolean;
  /** The one-time card that offers «نية اليوم» was dismissed. */
  intentionOfferDismissed: boolean;
  /** The evening review card from {@link HeartPrefs.eveningFrom}: opt-in. */
  eveningReview: boolean;
  /** When the evening review appears (and its reminder rings, on the clients): the user's choice. */
  eveningFrom: LocalTime;
  /** The weekly review card (the key keeps its first name, Friday's): on by default. */
  fridayReview: boolean;
  /** The weekly review's day, 0 = Sunday … 6 = Saturday; Friday by default. */
  reviewDay: number;
  /** «التزام شخصي»: opt-in. */
  pledges: boolean;
  /** «حلقة العادة» and «الاستمرار: ثلاث حقائق» were shown once (after the first habit). */
  cardsSeen: boolean;
}

export const DEFAULT_HEART_PREFS: HeartPrefs = {
  intention: false,
  intentionOfferDismissed: false,
  eveningReview: false,
  eveningFrom: EVENING_FROM,
  fridayReview: true,
  reviewDay: DEFAULT_REVIEW_DAY,
  pledges: false,
  cardsSeen: false,
};

/** «اليوم أعاهد الله على: …»: the habits ticked and an optional line of the user's own. */
export interface DayIntention {
  date: LocalDate;
  planIds: string[];
  pledge?: string;
}

export type PledgeKept = 'yes' | 'partly' | 'no';

export interface EveningReview {
  date: LocalDate;
  /** «هل وفيت بعهد اليوم؟», only when a line was set that day. */
  kept?: PledgeKept;
}

export type HeartFeeling = 'present' | 'middle' | 'hard';
export type StepChoice = 'increase' | 'lighten' | 'keep';
export const HEART_FEELINGS: readonly HeartFeeling[] = ['present', 'middle', 'hard'];
export const STEP_CHOICES: readonly StepChoice[] = ['increase', 'lighten', 'keep'];

/** One plan in a weekly review, with its title then (the plan may be gone when the review is read again). */
export interface ReviewPlan {
  planId: string;
  title: string;
  /** Asked days missed that week (0 for the steady ones). */
  missed: number;
}

export interface WeeklyReview {
  /** The Friday that closes the week (the week is the seven days ending on it). */
  weekOf: LocalDate;
  steady: ReviewPlan[];
  weak: ReviewPlan[];
  step?: { planId: string; choice: StepChoice };
  heart?: HeartFeeling;
  /** «رسالة إلى نفسي»: shown first on «ورد اليوم» the next Friday. */
  message?: string;
  /** The message was read («المعاتبة»). */
  messageSeen?: true;
  savedAt: IsoTime;
}

/**
 * What the user does when a habit is missed two days in a row: a good deed that wipes out sins (each with its evidence
 * on the clients), `sadaqah` with the user's own amount, or a `custom` line. One per habit, chosen per habit.
 */
export const PLEDGE_DEEDS = [
  'birr',
  'istighfar',
  'salawat',
  'tasbih',
  'tahlil',
  'sawm',
  'qiyam',
  'rakatain',
  'masjid',
  'adhkar',
  'quran',
  'saqy',
  'istighfarKabir',
] as const;
export type PledgeDeed = (typeof PLEDGE_DEEDS)[number];
export type PledgeAction = PledgeDeed | 'sadaqah' | 'custom';
export const PLEDGE_ACTIONS: readonly PledgeAction[] = [...PLEDGE_DEEDS, 'sadaqah', 'custom'];

/** «إن فاتتني يومين متتاليين: …». */
export interface Pledge {
  id: string;
  planId: string;
  action: PledgeAction;
  /** `sadaqah`: what (e.g. an amount); `custom`: the whole line. */
  text?: string;
  createdOn: LocalDate;
  /** The trigger days the user marked «وفيت به». */
  kept: LocalDate[];
}

export interface HeartData {
  v: typeof HEART_VERSION;
  prefs: HeartPrefs;
  intentions: DayIntention[];
  evenings: EveningReview[];
  weekly: WeeklyReview[];
  pledges: Pledge[];
}

export function emptyHeart(): HeartData {
  return { v: HEART_VERSION, prefs: { ...DEFAULT_HEART_PREFS }, intentions: [], evenings: [], weekly: [], pledges: [] };
}

/** 0 (Sunday) … 6 (Saturday). */
export function isWeekday(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** One line of the user's own words: trimmed, single spaces, at most {@link HEART_LINE_MAX} characters; empty → undefined. */
export function cleanLine(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const line = value.replace(/\s+/g, ' ').trim().slice(0, HEART_LINE_MAX).trim();
  return line.length > 0 ? line : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))] : [];
}

function reviewPlans(value: unknown): ReviewPlan[] {
  if (!Array.isArray(value)) return [];
  const out: ReviewPlan[] = [];
  for (const v of value) {
    if (!isRecord(v) || typeof v.planId !== 'string' || typeof v.title !== 'string') continue;
    const missed = typeof v.missed === 'number' && Number.isInteger(v.missed) && v.missed >= 0 ? v.missed : 0;
    out.push({ planId: v.planId, title: v.title.slice(0, 200), missed });
  }
  return out;
}

function byDate<T extends { date: LocalDate }>(items: T[]): T[] {
  const map = new Map<LocalDate, T>();
  for (const item of items) map.set(item.date, item);
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-HEART_DAYS_KEPT);
}

/** Never throws: anything invalid is dropped, never the rest. */
export function parseHeart(json: unknown): HeartData {
  let raw: unknown = json;
  if (typeof json === 'string') {
    try {
      raw = JSON.parse(json);
    } catch {
      return emptyHeart();
    }
  }
  if (!isRecord(raw) || raw.v !== HEART_VERSION) return emptyHeart();
  const out = emptyHeart();
  if (isRecord(raw.prefs)) {
    for (const k of Object.keys(DEFAULT_HEART_PREFS) as (keyof HeartPrefs)[]) {
      const v = raw.prefs[k];
      if (k === 'eveningFrom') {
        if (isValidTime(v)) out.prefs.eveningFrom = v as LocalTime;
      } else if (k === 'reviewDay') {
        if (isWeekday(v)) out.prefs.reviewDay = v;
      } else if (typeof v === 'boolean') {
        out.prefs[k] = v;
      }
    }
  }
  const intentions: DayIntention[] = [];
  for (const v of Array.isArray(raw.intentions) ? raw.intentions : []) {
    if (!isRecord(v) || !isValidDate(v.date)) continue;
    const pledge = cleanLine(v.pledge);
    intentions.push({ date: v.date, planIds: strings(v.planIds), ...(pledge ? { pledge } : {}) });
  }
  out.intentions = byDate(intentions);
  const evenings: EveningReview[] = [];
  for (const v of Array.isArray(raw.evenings) ? raw.evenings : []) {
    if (!isRecord(v) || !isValidDate(v.date)) continue;
    const kept = v.kept === 'yes' || v.kept === 'partly' || v.kept === 'no' ? v.kept : undefined;
    evenings.push({ date: v.date, ...(kept ? { kept } : {}) });
  }
  out.evenings = byDate(evenings);
  const weekly = new Map<LocalDate, WeeklyReview>();
  for (const v of Array.isArray(raw.weekly) ? raw.weekly : []) {
    if (!isRecord(v) || !isValidDate(v.weekOf) || !isIsoTime(v.savedAt)) continue;
    const review: WeeklyReview = { weekOf: v.weekOf, steady: reviewPlans(v.steady), weak: reviewPlans(v.weak), savedAt: v.savedAt };
    if (isRecord(v.step) && typeof v.step.planId === 'string' && STEP_CHOICES.includes(v.step.choice as StepChoice)) {
      review.step = { planId: v.step.planId, choice: v.step.choice as StepChoice };
    }
    if (HEART_FEELINGS.includes(v.heart as HeartFeeling)) review.heart = v.heart as HeartFeeling;
    const message = cleanLine(v.message);
    if (message) review.message = message;
    if (v.messageSeen === true) review.messageSeen = true;
    weekly.set(review.weekOf, review);
  }
  out.weekly = [...weekly.values()].sort((a, b) => (a.weekOf < b.weekOf ? -1 : 1)).slice(-WEEKLY_KEPT);
  const pledges: Pledge[] = [];
  for (const v of Array.isArray(raw.pledges) ? raw.pledges : []) {
    if (!isRecord(v) || typeof v.id !== 'string' || typeof v.planId !== 'string' || !isValidDate(v.createdOn)) continue;
    if (!PLEDGE_ACTIONS.includes(v.action as PledgeAction)) continue;
    const text = cleanLine(v.text);
    if (v.action === 'custom' && !text) continue;
    const kept = strings(v.kept).filter(isValidDate).sort().slice(-HEART_DAYS_KEPT);
    pledges.push({ id: v.id, planId: v.planId, action: v.action as PledgeAction, ...(text ? { text } : {}), createdOn: v.createdOn, kept });
  }
  out.pledges = pledges.slice(0, MAX_PLEDGES);
  return out;
}

export function serializeHeart(data: HeartData): string {
  return JSON.stringify(data);
}

export function setHeartPrefs(data: HeartData, patch: Partial<HeartPrefs>): HeartData {
  return { ...data, prefs: { ...data.prefs, ...patch } };
}

// ── المشارطة: «نية اليوم» ────────────────────────────────────────────────────────────────────────────────────

export function intentionOf(data: HeartData, date: LocalDate): DayIntention | undefined {
  return data.intentions.find((i) => i.date === date);
}

/**
 * What the top of «ورد اليوم» shows for «نية اليوم» until noon: `offer` (the one-time card that offers the setting),
 * `card` (the intention to make), `made` (one line: the intention of today), or null.
 */
export function intentionState(data: HeartData, date: LocalDate, time: LocalTime): 'offer' | 'card' | 'made' | null {
  if (time >= INTENTION_UNTIL) return null;
  if (!data.prefs.intention) return data.prefs.intentionOfferDismissed ? null : 'offer';
  return intentionOf(data, date) ? 'made' : 'card';
}

/** «عاهدت»: saves today's intention (replacing an earlier one of the same day). */
export function makeIntention(data: HeartData, input: { date: LocalDate; planIds: readonly string[]; pledge?: string }): HeartData {
  if (!isValidDate(input.date)) throw new RangeError('Invalid date');
  const pledge = cleanLine(input.pledge);
  const intention: DayIntention = { date: input.date, planIds: [...new Set(input.planIds)], ...(pledge ? { pledge } : {}) };
  return { ...data, intentions: byDate([...data.intentions.filter((i) => i.date !== input.date), intention]) };
}

// ── المحاسبة: the evening ────────────────────────────────────────────────────────────────────────────────────

export function eveningOf(data: HeartData, date: LocalDate): EveningReview | undefined {
  return data.evenings.find((e) => e.date === date);
}

/** The evening card shows from the user's time ({@link HeartPrefs.eveningFrom}) when on and today's review is not saved. */
export function eveningCardVisible(data: HeartData, date: LocalDate, time: LocalTime): boolean {
  return data.prefs.eveningReview && time >= data.prefs.eveningFrom && !eveningOf(data, date);
}

export function saveEvening(data: HeartData, review: EveningReview): HeartData {
  if (!isValidDate(review.date)) throw new RangeError('Invalid date');
  const clean: EveningReview = review.kept ? { date: review.date, kept: review.kept } : { date: review.date };
  return { ...data, evenings: byDate([...data.evenings.filter((e) => e.date !== review.date), clean]) };
}

// ── المحاسبة: the week ───────────────────────────────────────────────────────────────────────────────────────

export function weeklyOf(data: HeartData, weekOf: LocalDate): WeeklyReview | undefined {
  return data.weekly.find((w) => w.weekOf === weekOf);
}

/**
 * The review day whose weekly review is due now, or null: on the user's review day (all day), and the next day before
 * {@link NEXT_DAY_UNTIL} when it was skipped. Off when the setting is off or the review is saved.
 */
export function weeklyReviewDue(data: HeartData, date: LocalDate, time: LocalTime): LocalDate | null {
  if (!data.prefs.fridayReview) return null;
  const day = weekday(date);
  const reviewDay = data.prefs.reviewDay;
  const due = day === reviewDay ? date : day === (reviewDay + 1) % 7 && time < NEXT_DAY_UNTIL ? addDays(date, -1) : null;
  if (!due || weeklyOf(data, due)) return null;
  return due;
}

export interface WeekPlanSummary {
  planId: string;
  /** Asked days in the week up to the review day (excused days and pauses left out). */
  asked: number;
  done: number;
  missed: number;
}

/**
 * The week closing on `weekOf` (its seven days), per plan that asked something: «ما ثبتَّ عليه» (nothing missed) and
 * «أين ضعفت» (missed days, most first). Days after `today` are not counted yet.
 */
export function weekSummary(
  store: Store,
  weekOf: LocalDate,
  today: LocalDate,
  opts: PlanDayOptions = {},
): { steady: WeekPlanSummary[]; weak: WeekPlanSummary[] } {
  const from = addDays(weekOf, -6);
  const to = weekOf < today ? weekOf : today;
  const rows: WeekPlanSummary[] = [];
  for (const plan of store.plans) {
    let asked = 0;
    let done = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (isExcused(store, d) || !planAsksOn(plan, d, opts)) continue;
      asked++;
      if ((plan.log[d] ?? 0) > 0) done++;
    }
    if (asked > 0) rows.push({ planId: plan.id, asked, done, missed: asked - done });
  }
  return {
    steady: rows.filter((r) => r.missed === 0),
    weak: rows.filter((r) => r.missed > 0).sort((a, b) => b.missed - a.missed),
  };
}

/** The ladder value just below `amount`, or null at the bottom. */
export function previousStep(amount: number): number | null {
  let best: number | null = null;
  for (const v of LADDER) if (v < amount) best = v;
  return best;
}

/** «خطوة للأسبوع القادم» choices of a plan: «زِد خطوة» only where allowed (`canIncrease`), «خفّف» when there is a lower step. */
export function stepChoices(plan: Plan, today: LocalDate): StepChoice[] {
  const out: StepChoice[] = [];
  if (!isPaused(plan) && canIncrease(plan, today)) out.push('increase');
  if (previousStep(baseAmount(plan)) !== null) out.push('lighten');
  out.push('keep');
  return out;
}

/** Applies the chosen step to the plan (one ladder step up or down, or nothing). */
export function applyStep(plan: Plan, choice: StepChoice, today: LocalDate, now: IsoTime = nowIso()): Plan {
  if (choice === 'increase') return increase(plan, today, now);
  if (choice === 'lighten') {
    const lower = previousStep(baseAmount(plan));
    return lower === null ? plan : decreaseTo(plan, lower, today, now);
  }
  return plan;
}

export function saveWeeklyReview(data: HeartData, review: Omit<WeeklyReview, 'savedAt'>, now: IsoTime = nowIso()): HeartData {
  if (!isValidDate(review.weekOf)) throw new RangeError('Invalid weekOf');
  const message = cleanLine(review.message);
  const clean: WeeklyReview = { ...review, savedAt: now };
  if (message) clean.message = message;
  else delete clean.message;
  const weekly = [...data.weekly.filter((w) => w.weekOf !== review.weekOf), clean]
    .sort((a, b) => (a.weekOf < b.weekOf ? -1 : 1))
    .slice(-WEEKLY_KEPT);
  return { ...data, weekly };
}

/** Weekly reviews, newest first («المحاسبة» in «سجلّي»). */
export function reviewHistory(data: HeartData): WeeklyReview[] {
  return [...data.weekly].sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1));
}

// ── المعاتبة: «رسالة إلى نفسي» ──────────────────────────────────────────────────────────────────────────────

/**
 * On the review day, the message the user wrote in an earlier review (within the last two weeks) and has not read yet:
 * the first thing on «ورد اليوم» that day.
 */
export function selfMessageDue(data: HeartData, date: LocalDate): WeeklyReview | null {
  if (weekday(date) !== data.prefs.reviewDay) return null;
  const candidates = data.weekly.filter(
    (w) => w.message && !w.messageSeen && w.weekOf < date && diffDays(w.weekOf, date) <= 13,
  );
  return candidates.sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1))[0] ?? null;
}

export function markMessageSeen(data: HeartData, weekOf: LocalDate): HeartData {
  return { ...data, weekly: data.weekly.map((w) => (w.weekOf === weekOf ? { ...w, messageSeen: true as const } : w)) };
}

// ── المعاقبة: «التزام شخصي» ─────────────────────────────────────────────────────────────────────────────────

export function addPledge(data: HeartData, input: Omit<Pledge, 'kept'>): HeartData {
  if (!isValidDate(input.createdOn)) throw new RangeError('Invalid createdOn');
  const text = cleanLine(input.text);
  if (input.action === 'custom' && !text) throw new RangeError('A custom pledge needs its text');
  const pledge: Pledge = { id: input.id, planId: input.planId, action: input.action, ...(text ? { text } : {}), createdOn: input.createdOn, kept: [] };
  const others = data.pledges.filter((p) => p.id !== input.id && p.planId !== input.planId);
  return { ...data, pledges: [...others, pledge].slice(-MAX_PLEDGES) };
}

export function removePledge(data: HeartData, id: string): HeartData {
  return { ...data, pledges: data.pledges.filter((p) => p.id !== id) };
}

/** «وفيت به» for the trigger of `on`. */
export function keepPledge(data: HeartData, id: string, on: LocalDate): HeartData {
  return {
    ...data,
    pledges: data.pledges.map((p) => (p.id === id && !p.kept.includes(on) ? { ...p, kept: [...p.kept, on].sort().slice(-HEART_DAYS_KEPT) } : p)),
  };
}

export interface PledgeOptions extends PlanDayOptions {
  /** Now in milliseconds: yesterday is not counted as missed while it can still be made up («قضاء»). */
  now?: number;
}

/**
 * The day a pledge was triggered, or null: the later of the most recent two asked days in a row (days the plan does
 * not ask are passed over) with nothing logged, both after the pledge was made, neither excused («عذر» breaks the run),
 * and yesterday only once it can no longer be made up. Today never counts (it is still open).
 */
export function pledgeTrigger(store: Store, pledge: Pledge, today: LocalDate, opts: PledgeOptions = {}): LocalDate | null {
  const plan = store.plans.find((p) => p.id === pledge.planId);
  if (!plan || isPaused(plan)) return null;
  const now = opts.now ?? Date.now();
  const stop = addDays(today, -PLEDGE_LOOKBACK_DAYS);
  let laterMiss: LocalDate | null = null;
  for (let d = addDays(today, -1); d > stop && d >= pledge.createdOn; d = addDays(d, -1)) {
    if (canMakeUp(d, today, now, makeUpDeadline)) continue;
    if (isExcused(store, d)) {
      laterMiss = null;
      continue;
    }
    if (!planAsksOn(plan, d, opts)) continue;
    if ((plan.log[d] ?? 0) > 0) {
      laterMiss = null;
      continue;
    }
    if (laterMiss) return laterMiss;
    laterMiss = d;
  }
  return null;
}

/** Pledges whose trigger is open (not marked «وفيت به»), with the trigger day. Off unless the setting is on. */
export function pledgesDue(store: Store, data: HeartData, today: LocalDate, opts: PledgeOptions = {}): { pledge: Pledge; on: LocalDate }[] {
  if (!data.prefs.pledges) return [];
  const out: { pledge: Pledge; on: LocalDate }[] = [];
  for (const pledge of data.pledges) {
    const on = pledgeTrigger(store, pledge, today, opts);
    if (on && !pledge.kept.includes(on)) out.push({ pledge, on });
  }
  return out;
}

// ── المجاهدة: «أقل ما يمكن» ─────────────────────────────────────────────────────────────────────────────────

/** The amount «أقل ما يمكن» adds today, or null when the minimum is already logged or is the whole amount. */
export function minimumToLog(plan: Plan, date: LocalDate): number | null {
  const done = plan.log[date] ?? 0;
  const required = requiredOn(plan, date);
  const minimum = Math.min(minimumOf(plan), required);
  // When the minimum is the whole amount the tick already does it: no second action.
  if (minimum >= required || done >= minimum) return null;
  return minimum - done;
}

/** True when the day holds at least the minimum but not the whole amount (the row says «أقل ما يمكن ✓»). */
export function minimumMet(plan: Plan, date: LocalDate): boolean {
  const done = plan.log[date] ?? 0;
  return done > 0 && done < requiredOn(plan, date) && done >= Math.min(minimumOf(plan), requiredOn(plan, date));
}

/** «أقل ما يمكن»: logs the minimum for `date` the way the streak expects (it counts). Returns the plan unchanged when nothing is left to add. */
export function logMinimum(plan: Plan, date: LocalDate, today: LocalDate, now: IsoTime = nowIso()): Plan {
  const amount = minimumToLog(plan, date);
  return amount === null ? plan : logForDay(plan, date, amount, today, now);
}

// ── المراقبة: one rotating text ──────────────────────────────────────────────────────────────────────────────

/**
 * Published Quote ids already in the reviewed YAML files (checked by a backend test): Quran 11:114 and «نعمتان مغبون
 * فيهما…» (sin-programs.yaml: `afterFall` and the `waqt-tawasul` program), «ينزل ربنا كل ليلة…» (deed-schedules.yaml,
 * the night prayer). Never an invented id; the text is always read from the API, and the line hides without it.
 */
export const MURAQABA_QUOTE_IDS: readonly string[] = [
  'dc522d5d-3652-4e08-9d60-652da8fe39f1',
  '5518a387-d429-4a90-be10-c0609f66d7c9',
  '7935e301-711b-446d-812d-475545d186a6',
];

/** One id per day, rotating; null without ids. */
export function muraqabaQuoteId(date: LocalDate, ids: readonly string[] = MURAQABA_QUOTE_IDS): string | null {
  if (ids.length === 0 || !isValidDate(date)) return null;
  return ids[toDayNumber(date) % ids.length] ?? null;
}

/** «ما أتممت؟»: habits asked on `date`, and which of them have something logged. */
export function daySummary(store: Store, date: LocalDate, opts: PlanDayOptions = {}): { asked: Plan[]; done: Plan[] } {
  const asked = store.plans.filter((p) => planAsksOn(p, date, opts));
  return { asked, done: asked.filter((p) => (p.log[date] ?? 0) > 0) };
}
