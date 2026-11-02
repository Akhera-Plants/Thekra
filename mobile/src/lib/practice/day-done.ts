/**
 * «تمّ وردك اليوم» (owner round 3, item 4): no attributed text, one short achievement line from a rotating list
 * (`practice.celebrate.lines.{n}` in the i18n files), a different line each day and the same line all day long.
 */

import { toDayNumber, type LocalDate } from '@thekra/practice-core';

/** How many lines `practice.celebrate.lines` holds (keys 0…n-1, in both languages). */
export const DAY_DONE_LINES = 6;

export function dayDoneLineIndex(date: LocalDate, count = DAY_DONE_LINES): number {
  if (count <= 0) return -1;
  return ((toDayNumber(date) % count) + count) % count;
}

export function dayDoneLineKey(date: LocalDate): string {
  return `practice.celebrate.lines.${dayDoneLineIndex(date)}`;
}
