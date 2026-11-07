/**
 * Pure models of «عاداتي» (owner round 5, §1 IA; docs/plan/2026-11-07-owner-round-5.md): the four segmented tabs and
 * their `?tab=` param, the one heart card of «ورد اليوم» (F-06 / F-35 / A-01: one line and an action that opens a
 * sheet), the state of «صلّحها» (F-08 a: one good deed after two missed days), the weekly occasions as one row and the
 * next non-weekly one (A-28 a, F-17), the weakest habits of a weekly review (A-12 a), the last review day, and the
 * two optional questions of «أضف» saved as the plan's loop (F-13 a). Kept apart from the screens so a test can hold
 * every choice.
 */

import {
  addDays,
  diffDays,
  isRemindableOccasionRule,
  occurrences,
  weekday,
  type AgendaOccasion,
  type HabitLoop,
  type HeartSlot,
  type IsoTime,
  type LocalDate,
  type MakeUpOffer,
  type Rule,
  type WeeklyReview,
} from '@thekra/practice-core';

// ── The tabs of «عاداتي» ────────────────────────────────────────────────────────────────────────────────────────

/** In order. The keys are the `?tab=` values of the nav map (`/habits?tab=wird` …). */
export const HABITS_TABS = ['wird', 'periodic', 'review', 'record'] as const;
export type HabitsTab = (typeof HABITS_TABS)[number];

/** The tab a link asks for; anything else (none, an old value) opens «ورد اليوم». */
export function parseHabitsTab(raw: unknown): HabitsTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (HABITS_TABS as readonly string[]).includes(value as string) ? (value as HabitsTab) : 'wird';
}

// ── The heart card ──────────────────────────────────────────────────────────────────────────────────────────────

/** What the sheet of the heart card holds. */
export type HeartSheet = 'intention-offer' | 'intention' | 'evening' | 'weekly' | 'usual-deed';

export interface HeartCardView {
  /** i18n key of the card's one line. */
  lineKey: string;
  /** i18n key of the action on the line, or null (a line that only tells: the intention already made). */
  actionKey: string | null;
  sheet: HeartSheet | null;
}

/**
 * The card for practice-core `heartSlot`'s answer (null: no card). One line each; the action opens the sheet with the
 * form, so the habits stay at the top of the page (A-01 a).
 */
export function heartCardView(slot: HeartSlot | null): HeartCardView | null {
  if (!slot) return null;
  switch (slot.kind) {
    case 'intention':
      if (slot.state === 'offer') return { lineKey: 'habitsTab.heart.offerLine', actionKey: 'habitsTab.heart.start', sheet: 'intention-offer' };
      if (slot.state === 'card') return { lineKey: 'habitsTab.heart.intentionLine', actionKey: 'habitsTab.heart.start', sheet: 'intention' };
      return { lineKey: 'habitsTab.heart.intentionMade', actionKey: null, sheet: null };
    case 'evening':
      return { lineKey: 'habitsTab.heart.eveningLine', actionKey: 'habitsTab.heart.start', sheet: 'evening' };
    case 'weekly':
      return { lineKey: 'habitsTab.heart.weeklyLine', actionKey: 'habitsTab.heart.start', sheet: 'weekly' };
    case 'usual-deed':
      return {
        lineKey: slot.reason === 'excused' ? 'habitsTab.heart.usualExcused' : 'habitsTab.heart.usualHeavy',
        actionKey: 'habitsTab.heart.read',
        sheet: 'usual-deed',
      };
  }
}

// ── «صلّحها» ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What «صلّحها» shows for one habit:
 * - `none`: nothing to mend (no button on the row);
 * - `steps`: missed yesterday only: the three steps («لا تفوّتها مرتين», «اقضِ ما فاتك», «خفّف المقدار»);
 * - `offer`: missed two asked days in a row (practice-core `makeUpOffer`): «أتبع السيئة الحسنة: اختر عملًا واحدًا
 *   اليوم» with the deeds, then the steps;
 * - `chosen`: a deed was chosen for this run of misses and is not done yet: the deed and «فعلته»;
 * - `done`: the chosen deed was done: no button on the row any more.
 */
export type MendState = 'none' | 'steps' | 'offer' | 'chosen' | 'done';

export function mendState(args: { offer: MakeUpOffer | null; missedYesterday: boolean; doneToday: number; paused: boolean }): MendState {
  if (args.paused) return 'none';
  if (args.offer) {
    if (args.offer.chosen?.done) return 'done';
    if (args.offer.chosen) return 'chosen';
    return 'offer';
  }
  return args.missedYesterday && args.doneToday <= 0 ? 'steps' : 'none';
}

/** The row carries «صلّحها» in these states. */
export function showsMend(state: MendState): boolean {
  return state === 'steps' || state === 'offer' || state === 'chosen';
}

// ── Occasions ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A weekly rule (Mondays and Thursdays, Friday): one row «كل …» instead of a mark every week (A-28 a). */
export function isWeeklyRule(rule: Rule): boolean {
  return rule.kind === 'weekdays' || rule.kind === 'daily';
}

/** «كل اثنين وخميس» / «Every Monday and Thursday», from the weekday names («الاثنين» → «اثنين»). */
export function weeklyLabel(days: readonly number[], lang: 'ar' | 'en', dayName: (day: number) => string): string {
  const names = [...days].sort((a, b) => a - b).map((d) => {
    const name = dayName(d);
    return lang === 'ar' ? name.replace(/^ال/, '') : name;
  });
  if (lang === 'ar') return `كل ${names.join(' و')}`;
  const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Every ${list}`;
}

/** The weekly occasions and the others (marked on the calendar), in catalog order. */
export function splitOccasions<O extends Pick<AgendaOccasion, 'rule'>>(occasions: readonly O[]): { weekly: O[]; other: O[] } {
  return {
    weekly: occasions.filter((o) => isWeeklyRule(o.rule)),
    other: occasions.filter((o) => !isWeeklyRule(o.rule)),
  };
}

/** How far ahead «مناسبة قريبة» looks (F-17: «قريبة»). */
export const OCCASION_AHEAD_DAYS = 10;

/**
 * «مناسبة قريبة»: the next non-weekly occasion with a day from today to {@link OCCASION_AHEAD_DAYS} days ahead, or null
 * (the home section hides). A window already running (the ten days) reads as today. A rule the runtime cannot evaluate
 * (Hijri without Umm al-Qura) is skipped: a wrong date is worse than none.
 */
export function nextOccasion<O extends AgendaOccasion>(
  occasions: readonly O[],
  today: LocalDate,
  hijriOffset = 0,
  ahead = OCCASION_AHEAD_DAYS,
): { occasion: O; date: LocalDate; inDays: number } | null {
  let best: { occasion: O; date: LocalDate; inDays: number } | null = null;
  for (const occasion of occasions) {
    if (!isRemindableOccasionRule(occasion.rule)) continue;
    let first: LocalDate | undefined;
    try {
      first = occurrences(occasion.rule, today, addDays(today, ahead), { hijriOffset })[0];
    } catch {
      continue;
    }
    if (first && (!best || first < best.date)) best = { occasion, date: first, inDays: diffDays(today, first) };
  }
  return best;
}

// ── المحاسبة ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The latest review day on or before `today` (0 = Sunday … 6 = Saturday): the week «ابدأ الآن» reviews. */
export function lastReviewDay(today: LocalDate, reviewDay: number): LocalDate {
  return addDays(today, -((weekday(today) - reviewDay + 7) % 7));
}

/** A review's habits, weakest first (A-12 a: one line each with «فاتك n»); the steady ones after, missed 0. */
export function reviewLines(review: Pick<WeeklyReview, 'steady' | 'weak'>): { planId: string; title: string; missed: number }[] {
  const weak = [...review.weak].sort((a, b) => b.missed - a.missed);
  return [...weak, ...review.steady.map((s) => ({ ...s, missed: 0 }))];
}

/** How many lines a review shows before «المزيد» (A-12 a: the weakest two). */
export const REVIEW_LINES_SHOWN = 2;

// ── «أضف»: the two optional questions (F-13 a) ────────────────────────────────────────────────────────────────

export interface LoopAnswers {
  /** «بعد ماذا ستفعلها؟» */
  after: string;
  /** «إذا منعك شيء، فماذا تفعل؟» */
  ifBlocked: string;
}

/**
 * The plan's loop from the two answers, or null when both are empty (the questions are optional). The routine is the
 * habit itself; the answers are the cue and the «if … then» plan.
 */
export function loopFromAnswers(answers: LoopAnswers, habitTitle: string, id: string, now: IsoTime): HabitLoop | null {
  const after = answers.after.replace(/\s+/g, ' ').trim().slice(0, 300);
  const ifBlocked = answers.ifBlocked.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!after && !ifBlocked) return null;
  const loop: HabitLoop = { id, cue: after, craving: '', routine: habitTitle.trim().slice(0, 300) || '—', reward: '', updatedAt: now };
  if (ifBlocked) loop.ifThen = ifBlocked;
  return loop;
}

/** The answers saved on a plan (its first loop), for the habit page; empty strings when none. */
export function answersOf(loops: readonly HabitLoop[] | undefined): LoopAnswers {
  const first = loops?.[0];
  return { after: first?.cue ?? '', ifBlocked: first?.ifThen ?? '' };
}

// ── Days of a habit (A-13 a) ─────────────────────────────────────────────────────────────────────────────────

/**
 * practice-core `validatePlan` accepts 2–7 days a week only. One picked day («قيام ليلة الجمعة», a single weekday in the
 * add steps or the edit sheet) used to give 1 and threw «Invalid plan» (a blank screen). Until the core accepts 1, the
 * count is held at 2; the rule keeps the one day the user picked, so reminders and «ليست مطلوبة اليوم» are right.
 */
export const MIN_ACTIVE_DAYS = 1;

/** A-13 a: the user picks the days only; the count per week follows them (at least {@link MIN_ACTIVE_DAYS}). */
export function activeDaysFrom(weekdays: readonly number[] | null, fallback: number): number {
  if (!weekdays) return fallback;
  return Math.max(MIN_ACTIVE_DAYS, Math.min(7, new Set(weekdays).size));
}
