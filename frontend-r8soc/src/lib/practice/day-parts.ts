/**
 * «بداية اليوم · خلال اليوم · ختام اليوم» (round 6 §2, reference «اليوم» tab): the part of the day a habit belongs to,
 * from its first reminder — the same rule as the app (`mobile/src/lib/practice/hub-view.ts` `bandOf`), so a habit sits
 * in the same band on both platforms:
 * - a prayer anchor: after Fajr → start; after Dhuhr / Asr → during; after Maghrib / Isha / before sleep → end;
 * - a fixed time: before 10:00 → start; before 18:00 → during; then end;
 * - no reminder → during.
 * Pure.
 */
import { isPrayerAnchor, slotChoices, type Plan, type PrayerAnchor } from '@thekra/practice-core';

export type DayPart = 'start' | 'during' | 'end';
export const DAY_PARTS: readonly DayPart[] = ['start', 'during', 'end'];

const ANCHOR_PART: Readonly<Record<PrayerAnchor, DayPart>> = {
  'after-fajr': 'start',
  'after-dhuhr': 'during',
  'after-asr': 'during',
  'after-maghrib': 'end',
  'after-isha': 'end',
  'before-sleep': 'end',
};

export function dayPartOfTime(time: string): DayPart {
  if (time < '10:00') return 'start';
  if (time < '18:00') return 'during';
  return 'end';
}

export function dayPartOf(plan: Pick<Plan, 'slots' | 'slotAnchors'>): DayPart {
  const first = slotChoices(plan)[0];
  if (first === undefined) return 'during';
  return isPrayerAnchor(first) ? ANCHOR_PART[first] : dayPartOfTime(first);
}

/** Items grouped by part, in {@link DAY_PARTS} order, empty parts left out; each group keeps the input order. */
export function groupByDayPart<T>(items: readonly T[], partOf: (item: T) => DayPart): { part: DayPart; items: T[] }[] {
  return DAY_PARTS.map((part) => ({ part, items: items.filter((item) => partOf(item) === part) })).filter((g) => g.items.length > 0);
}
