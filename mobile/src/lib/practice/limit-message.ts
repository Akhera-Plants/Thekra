/**
 * The limit sheet's words (owner round 3, item 16) from practice-core `limitBlock`: why adding is refused and, when it
 * unlocks by itself, the day. Pure: the sheet passes the date formatter (Western digits) and `t`.
 *
 * - `habits_young`: 3 habits younger than three months; a new one fits on {date}, or after pausing one;
 * - `programs_young`: a running «تخفَّف» program has not lasted two months yet; the next one may start on {date};
 * - `programs_full`: 3 programs; finish one first;
 * - `periodic_full`: 8 periodic acts; delete one first.
 */

import type { LimitBlock } from '@thekra/practice-core';

export interface LimitMessage {
  /** i18n key under `practice.limits.why`. */
  key: string;
  params: { count: number; max: number; date?: string };
}

export function limitMessage(block: LimitBlock, formatDate: (date: string) => string): LimitMessage {
  const params: LimitMessage['params'] = { count: block.count, max: block.max };
  if (block.unlocksOn) params.date = formatDate(block.unlocksOn);
  const dated = block.unlocksOn !== null && (block.reason === 'habits_young' || block.reason === 'programs_young');
  return { key: `practice.limits.why.${block.reason}${dated ? '' : 'NoDate'}`, params };
}
