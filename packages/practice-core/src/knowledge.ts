/**
 * «المعرفة والقلب» (redesign §4.5): the pure parts of «حصيلتي», the celebration after a tick, the stories at
 * moments, «شعبة الأسبوع» and the onboarding defaults. Texts are always Quote ids or ayah references read from the
 * API by the clients; nothing here holds religious text.
 */
import { fromDayNumber, isValidDate, toDayNumber, weekday, type LocalDate } from './dates.js';
import { planAsksOn, type PlanDayOptions } from './agenda.js';
import { isPaused, type Plan } from './plan.js';
import type { SinProgram } from './sin-program.js';
import type { Store } from './storage.js';

// ── «حصيلتي» ────────────────────────────────────────────────────────────────────────────────────────────────

export interface HabitTally {
  planId: string;
  /** Logged in today's calendar month, in the plan's unit. */
  month: number;
  /** Logged since the plan started, in the plan's unit. */
  total: number;
}

/** What a habit has gathered: this month and since the start (days cleared by a correction count 0). */
export function habitTally(plan: Plan, today: LocalDate): HabitTally {
  const month = today.slice(0, 7);
  let monthSum = 0;
  let total = 0;
  for (const [date, amount] of Object.entries(plan.log)) {
    if (!(amount > 0) || date > today) continue;
    total += amount;
    if (date.startsWith(month)) monthSum += amount;
  }
  return { planId: plan.id, month: monthSum, total };
}

/** One tally per plan that has logged anything, in the store's order. */
export function tallies(store: Store, today: LocalDate): HabitTally[] {
  return store.plans.map((plan) => habitTally(plan, today)).filter((t) => t.total > 0);
}

/** «تخفَّف» inside its locked page: every day marked «ثبتّ» since the start (never reset by a fall). */
export function heldDaysTotal(program: SinProgram, today: LocalDate): number {
  return program.checkIns.filter((c) => c.value === 'held' && c.date <= today).length;
}

/**
 * «أنت تعمل على N شعب»: the distinct branches of faith behind the deeds of the habits not paused (deed → branch numbers
 * from the catalog's `deedBranches`). Empty when no habit's deed maps to a branch (the line is then omitted).
 */
export function branchesInPractice(plans: readonly Plan[], deedBranches: Readonly<Record<string, readonly number[]>>): number[] {
  const out = new Set<number>();
  for (const plan of plans) {
    if (isPaused(plan)) continue;
    for (const n of deedBranches[plan.deedSlug] ?? []) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** The two lines under «حصيلتي» (gratitude, sincerity): Quran 16:53 and 49:17, read by ayah from the API. */
export const GRATITUDE_AYAHS: readonly { surah: number; ayah: number }[] = [
  { surah: 16, ayah: 53 },
  { surah: 49, ayah: 17 },
];

/** One of {@link GRATITUDE_AYAHS} per day, rotating. */
export function gratitudeAyah(date: LocalDate): { surah: number; ayah: number } {
  const n = isValidDate(date) ? toDayNumber(date) : 0;
  return GRATITUDE_AYAHS[((n % GRATITUDE_AYAHS.length) + GRATITUDE_AYAHS.length) % GRATITUDE_AYAHS.length]!;
}

// ── «تمّ وردك اليوم» ────────────────────────────────────────────────────────────────────────────────────────

/** The habits asked on `date`, and whether every one of them has its amount (the day is complete). */
export function dayCompletion(store: Store, date: LocalDate, opts: PlanDayOptions = {}): { asked: Plan[]; complete: boolean } {
  const asked = store.plans.filter((p) => planAsksOn(p, date, opts));
  const complete = asked.length > 0 && asked.every((p) => (p.log[date] ?? 0) > 0);
  return { asked, complete };
}

/** One reward text for a completed day, from the evidence ids of its habits; the same all day. Null without ids. */
export function rewardQuoteId(evidenceIds: readonly string[], date: LocalDate): string | null {
  const ids = [...new Set(evidenceIds)];
  if (ids.length === 0) return null;
  const n = isValidDate(date) ? toDayNumber(date) : 0;
  return ids[((n % ids.length) + ids.length) % ids.length] ?? null;
}

// ── Stories at moments ──────────────────────────────────────────────────────────────────────────────────────

/** The moment a story belongs to → its key in `heart-texts.yaml` `stories:`. */
export const STORY_MOMENTS = {
  /** After a fall in «تخفَّف»: the man who killed a hundred. */
  afterFall: 'qatil-al-mia',
  /** On a heavy day: «إذا مرض العبد أو سافر…». */
  heavyDay: 'marad-safar',
  /** Starting late («ابدأ بغرسٍ صغير», first time): the sapling («فسيلة»). */
  lateStart: 'fasila',
  /** A small-deed nudge: the branch of thorns («غصن شوك»). */
  smallDeed: 'ghusn-shawk',
} as const;

export type StoryMoment = keyof typeof STORY_MOMENTS;

/** The Quote id of a moment's story, or null while the id is not filled (the UI then hides the story). */
export function storyQuoteId(moment: StoryMoment, stories: Readonly<Record<string, string | null>> | undefined): string | null {
  const id = stories?.[STORY_MOMENTS[moment]];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

// ── «شعبة الأسبوع» ──────────────────────────────────────────────────────────────────────────────────────────

/** ISO-8601 week of a date: the week of its Thursday (weeks start on Monday). */
export function isoWeek(date: LocalDate): { year: number; week: number } {
  const day = toDayNumber(date);
  const dow = weekday(date);
  const isoDow = dow === 0 ? 7 : dow;
  const thursday = day - isoDow + 4;
  const year = Number(fromDayNumber(thursday).slice(0, 4));
  const jan1 = toDayNumber(`${year}-01-01`);
  return { year, week: Math.floor((thursday - jan1) / 7) + 1 };
}

/** The number of branches of faith. */
export const BRANCH_COUNT = 77;

/** «شعبة الأسبوع»: the same branch (1…count) for everyone during one ISO week, walking through all of them in turn. */
export function branchOfWeek(date: LocalDate, count: number = BRANCH_COUNT): number {
  if (count <= 0) return 1;
  const { year, week } = isoWeek(date);
  const index = (year * 53 + week) % count;
  return index + 1;
}

// ── Onboarding («ماذا؟ متى؟ كم؟») ────────────────────────────────────────────────────────────────────────────

/** «تخطَّ» on «ماذا؟» chooses this catalog habit when it is offered, else the first one offered. */
export const ONBOARDING_DEFAULT_HABIT = 'adhkar-sabah-masa';

export const ONBOARDING_STEPS = ['what', 'when', 'howMuch'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The habit «تخطَّ» picks among the keys offered (catalog order). */
export function defaultHabitKey(offered: readonly string[]): string | null {
  return offered.includes(ONBOARDING_DEFAULT_HABIT) ? ONBOARDING_DEFAULT_HABIT : (offered[0] ?? null);
}

/** The first-run stepper ends with the two switches of «نية اليوم» and «المحاسبة المسائية» only before any habit. */
export function isFirstHabit(store: Store): boolean {
  return store.plans.length === 0;
}

// ── Educational cards ───────────────────────────────────────────────────────────────────────────────────────

/** «حلقة العادة»: تنبيه → نية → عمل صغير → قبول وفرح → تكرار (the labels are client copy under these keys). */
export const HABIT_LOOP_STEPS = ['cue', 'intention', 'smallDeed', 'joy', 'repeat'] as const;
/** How a sin grows: خاطرة → فكرة → شهوة → عزيمة → فعل → عادة. */
export const SIN_STEPS = ['passing', 'thought', 'desire', 'resolve', 'act', 'habit'] as const;
/** «الاستمرار: ثلاث حقائق». */
export const CONSISTENCY_FACTS = ['twoMonths', 'oneDay', 'neglect'] as const;
