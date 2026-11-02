/**
 * «لحظة مجاهدة» (was «لحظة ضعف», owner round 3, item 15): the rotating texts and the reward arithmetic of the tasbih
 * counter. Pure.
 */
import { urgeTextIndex, type LocalDate } from '@thekra/practice-core';
import type { MujahadaTexts } from '@/lib/types/practice';

/** «الحسنة بعشر أمثالها إلى سبعمائة ضعف» (al-Bukhari 6491, the catalog's `multiplierHadith`). */
export const REWARD_MIN = 10;
export const REWARD_MAX = 700;

/** What `count` good deeds are written as: ten times, up to seven hundred times, if Allah accepts them. */
export function rewardRange(count: number): { min: number; max: number } {
  const n = Math.max(0, Math.floor(count));
  return { min: n * REWARD_MIN, max: n * REWARD_MAX };
}

/** One item of the rotation: a Quran passage (1–3 verse ids shown together) or one scholar's saying. */
export type MujahadaItem = { kind: 'passage'; ids: string[] } | { kind: 'saying'; id: string };

/** The passages, then the sayings: what rotates during the timer. Never a text about despair or a slip. */
export function mujahadaItems(texts: MujahadaTexts | undefined): MujahadaItem[] {
  if (!texts) return [];
  return [
    ...texts.verses.filter((ids) => ids.length > 0).map((ids): MujahadaItem => ({ kind: 'passage', ids })),
    ...texts.sayings.map((id): MujahadaItem => ({ kind: 'saying', id })),
  ];
}

/** Every id the screen reads (one request for all). */
export function mujahadaIds(texts: MujahadaTexts | undefined): string[] {
  if (!texts) return [];
  return [
    ...texts.verses.flat(),
    ...texts.sayings,
    ...(texts.multiplierHadith ? [texts.multiplierHadith] : []),
    ...(texts.sittingPrayerHadith ? [texts.sittingPrayerHadith] : []),
  ];
}

/** The item shown now: a new one every two minutes, starting at a different one each day. -1 when none. */
export function mujahadaIndex(count: number, today: LocalDate, elapsedSeconds: number): number {
  return urgeTextIndex(count, today, elapsedSeconds);
}
