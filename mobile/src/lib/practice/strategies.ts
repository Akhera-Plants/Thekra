/**
 * Where «جرّبها» leads in the app for each strategy (practice-core `STRATEGIES`), and the device switch it turns on
 * first (opt-in: only on this explicit tap). Kept apart from the screen so a test can check every mapping.
 *
 * Owner round 3: «أتبِع السيئةَ الحسنة» opens a short list of easy, high-reward good deeds (`kind: 'deeds'`), never
 * «تخفَّف»; «لا تفوّتها مرتين» is not listed (it appears in context the day after a habit is missed).
 */

import type { Href } from 'expo-router';
import { STRATEGIES, type HeartPrefs, type Strategy, type StrategyAction } from '@thekra/practice-core';

export type StrategyTarget = { kind: 'screen'; href: Href; heart?: Partial<HeartPrefs> } | { kind: 'deeds' };

/** Strategies not shown in the list (they appear in context instead). */
export const UNLISTED_STRATEGIES: readonly string[] = ['never-twice'];

/** The strategies the page lists, in practice-core's order. */
export function listedStrategies(): Strategy[] {
  return STRATEGIES.filter((s) => !UNLISTED_STRATEGIES.includes(s.key));
}

export function strategyTarget(action: StrategyAction, key?: string): StrategyTarget {
  if (key === 'follow-good') return { kind: 'deeds' };
  const screen = (href: Href, heart?: Partial<HeartPrefs>): StrategyTarget => (heart ? { kind: 'screen', href, heart } : { kind: 'screen', href });
  switch (action) {
    case 'add':
      return screen('/practice/add');
    case 'habits':
      return screen('/record');
    case 'wird':
      return screen('/habits');
    case 'record':
      return screen('/record');
    case 'seasons':
      return screen('/practice/calendar');
    case 'moment':
      return screen('/practice/moment');
    case 'leaveSin':
      return screen('/practice/sin-program');
    case 'friends':
      return screen({ pathname: '/practice/kinship', params: { circle: 'friends' } });
    case 'pledges':
      return screen('/practice/pledges', { pledges: true });
    case 'evening':
      return screen('/settings/notifications', { eveningReview: true });
  }
}
