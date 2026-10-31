/**
 * Where «جرّبها» leads in the app for each strategy (practice-core `STRATEGIES`), and the device switch it turns on
 * first (opt-in: only on this explicit tap). Kept apart from the screen so a test can check every mapping.
 */

import type { Href } from 'expo-router';
import type { HeartPrefs, StrategyAction } from '@thekra/practice-core';

export interface StrategyTarget {
  href: Href;
  heart?: Partial<HeartPrefs>;
}

export function strategyTarget(action: StrategyAction): StrategyTarget {
  switch (action) {
    case 'add':
      return { href: '/practice/add' };
    case 'habits':
      return { href: '/practice/habits' };
    case 'wird':
      return { href: '/habits' };
    case 'record':
      return { href: '/record' };
    case 'seasons':
      return { href: '/practice/calendar' };
    case 'moment':
      return { href: '/practice/moment' };
    case 'leaveSin':
      return { href: '/practice/sin-program' };
    case 'friends':
      return { href: { pathname: '/practice/kinship', params: { circle: 'friends' } } };
    case 'pledges':
      return { href: '/practice/pledges', heart: { pledges: true } };
    case 'evening':
      return { href: '/settings', heart: { eveningReview: true } };
  }
}
