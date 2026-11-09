import { navFeature, type HeartPrefs, type StrategyAction } from '@thekra/practice-core';

/** Where «جرّبها» leads on the web, and the device switch it turns on first (if any). */
export interface StrategyTarget {
  href: string | { pathname: string; query: Record<string, string> };
  /** «نية اليوم والمحاسبة» switch turned on before leaving (opt-in: only on this explicit tap). */
  heart?: Partial<HeartPrefs>;
}

/** A page's web route from the shared navigation map (practice-core `nav-map.ts`). */
function web(key: string): string {
  const route = navFeature(key)?.web;
  if (!route) throw new RangeError(`No web route for ${key}`);
  return route;
}

/** Where «جرّبها» leads: a round-5 place of the shared navigation map (F-12 a: each strategy opens its moment). */
export function strategyTarget(action: StrategyAction): StrategyTarget {
  switch (action) {
    case 'add':
      return { href: { pathname: web('wird'), query: { add: '1' } } };
    case 'habits':
      return { href: web('wird') };
    case 'wird':
      return { href: web('wird') };
    case 'record':
      return { href: web('record') };
    case 'seasons':
      // No «مواسم الخير» page (F-17): the occasions are on the «سجلّي» calendar.
      return { href: web('record') };
    case 'moment':
      return { href: web('moment') };
    case 'leaveSin':
      return { href: web('leave-sin') };
    case 'friends':
      return { href: { pathname: web('people'), query: { circle: 'friends' } } };
    case 'pledges':
      // Round 5 (F-08 a): no pledge set-up page; the good deed is offered in «صلّحها». Its moment is «محاسبتي».
      return { href: web('review') };
    case 'evening':
      return { href: web('review'), heart: { eveningReview: true } };
  }
}

// The families «بناء / ترك / عودة», the unlisted «لا تفوّتها مرتين» and «طبّقها على عادة» are shared with the app:
// practice-core `strategies.ts` (`STRATEGY_KINDS`, `listedStrategies`, `strategyAppliesToHabit`).
