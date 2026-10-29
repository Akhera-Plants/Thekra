/**
 * Fresh starts on the Hijri calendar (docs/plan/2026-10-tazkiya-tracker-proposals.md item 6; the fresh-start effect,
 * Dai, Milkman & Riis 2014): a quiet hub card on the first ten days of Dhu al-Hijja, in Sha'ban (preparing for
 * Ramadan), on the first three days of a Hijri month, on Friday and on Monday. At most one card a day, the first
 * in that order that the user has not set aside. Each card is set aside per occasion: the whole ten days, the whole
 * of Sha'ban, the month's start, or the one Friday or Monday.
 *
 * The card invites «جدّد نيّتك», and «زِد خطوة» when a plan may climb (plan.ts `canIncrease`), or «ابدأ عادة صغيرة»
 * when there is no habit yet. The wording is catalog content (`tazkiya.freshStarts`). No notifications.
 */
import { weekday, type LocalDate } from './dates.js';
import { toHijri } from './hijri.js';
import { canIncrease, normalize, type Plan } from './plan.js';

export const FRESH_START_KINDS = ['dhul-hijja-ten', 'shaban', 'month-start', 'friday', 'monday'] as const;
export type FreshStartKind = (typeof FRESH_START_KINDS)[number];

const SHABAN = 8;
const DHUL_HIJJA = 12;
const TEN_DAYS = 10;
/** «The first days of a Hijri month»: days 1…3. */
export const MONTH_START_DAYS = 3;
const FRIDAY = 5;
const MONDAY = 1;

export interface FreshStart {
  kind: FreshStartKind;
  /** One occasion (the whole ten days, one month's start, one Friday…): the key that «ليس الآن» sets aside. */
  key: string;
}

/**
 * Every fresh start of `date`, in the order they win. Hijri occasions use the user's offset; on a runtime without
 * Umm al-Qura only Friday and Monday remain (a wrong Hijri day is worse than none).
 */
export function freshStarts(date: LocalDate, hijriOffset = 0): FreshStart[] {
  const out: FreshStart[] = [];
  try {
    const h = toHijri(date, hijriOffset);
    if (h.month === DHUL_HIJJA && h.day <= TEN_DAYS) out.push({ kind: 'dhul-hijja-ten', key: `dhul-hijja-ten:${h.year}` });
    if (h.month === SHABAN) out.push({ kind: 'shaban', key: `shaban:${h.year}` });
    if (h.day <= MONTH_START_DAYS) out.push({ kind: 'month-start', key: `month-start:${h.year}-${h.month}` });
  } catch {
    // No Umm al-Qura on this runtime.
  }
  const day = weekday(date);
  if (day === FRIDAY) out.push({ kind: 'friday', key: `friday:${date}` });
  if (day === MONDAY) out.push({ kind: 'monday', key: `monday:${date}` });
  return out;
}

/** The key under which a fresh-start card is set aside (shares the journal's `dismissed` list). */
export function freshStartKey(start: FreshStart): string {
  return `fresh:${start.key}`;
}

/** The one card of the day: the first fresh start not set aside, or null. */
export function freshStartFor(date: LocalDate, hijriOffset: number, dismissed: readonly string[]): FreshStart | null {
  return freshStarts(date, hijriOffset).find((s) => !dismissed.includes(freshStartKey(s))) ?? null;
}

/** What the card offers besides «جدّد نيّتك». */
export type FreshStartAction = { kind: 'increase'; planId: string } | { kind: 'start' } | { kind: 'renew' };

/**
 * «زِد خطوة» for the first plan that may climb today (the existing increase flow opens that plan), «ابدأ عادة
 * صغيرة» without any habit, else only the renewal.
 */
export function freshStartAction(plans: readonly Plan[], today: LocalDate): FreshStartAction {
  if (plans.length === 0) return { kind: 'start' };
  const ready = plans.find((p) => p.createdOn <= today && canIncrease(normalize(p, today), today));
  return ready ? { kind: 'increase', planId: ready.id } : { kind: 'renew' };
}
