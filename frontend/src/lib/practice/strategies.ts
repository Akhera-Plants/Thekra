import type { HeartPrefs, StrategyAction } from '@thekra/practice-core';

/** Where «جرّبها» leads on the web, and the device switch it turns on first (if any). */
export interface StrategyTarget {
  href: string | { pathname: string; query: Record<string, string> };
  /** «نية اليوم والمحاسبة» switch turned on before leaving (opt-in: only on this explicit tap). */
  heart?: Partial<HeartPrefs>;
}

export function strategyTarget(action: StrategyAction): StrategyTarget {
  switch (action) {
    case 'add':
      return { href: { pathname: '/practice/habits', query: { add: '1' } } };
    case 'habits':
      return { href: '/practice/habits' };
    case 'wird':
      return { href: '/practice' };
    case 'record':
      return { href: '/practice/record' };
    case 'seasons':
      return { href: '/calendar' };
    case 'moment':
      return { href: '/practice/leave-sin/moment' };
    case 'leaveSin':
      return { href: '/practice/leave-sin' };
    case 'friends':
      return { href: { pathname: '/practice/kinship', query: { circle: 'friends' } } };
    case 'pledges':
      return { href: '/practice/notifications', heart: { pledges: true } };
    case 'evening':
      return { href: '/practice/notifications', heart: { eveningReview: true } };
  }
}
