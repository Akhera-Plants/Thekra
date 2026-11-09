import { navFeature, type HeartPrefs, type Strategy, type StrategyAction } from '@thekra/practice-core';

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

/**
 * Strategies shown in the list (owner round 3, item 14): «لا تفوّتها مرتين» is not listed; it appears in context, on
 * a habit's row the day after it was missed.
 */
export const IN_CONTEXT_STRATEGIES: readonly string[] = ['never-twice'];

export function listedStrategies<T extends Pick<Strategy, 'key'>>(strategies: readonly T[]): T[] {
  return strategies.filter((s) => !IN_CONTEXT_STRATEGIES.includes(s.key));
}

/**
 * The three families of «استراتيجيات العادات» (owner round 6, C-18 a: the reference's «بناء / ترك / عودة»): building a
 * habit, leaving a sin («تخفّف»), and coming back after a gap. Every practice-core strategy has exactly one family
 * (`strategies.spec.ts`).
 */
export type StrategyKind = 'build' | 'leave' | 'return';
export const STRATEGY_KINDS: readonly StrategyKind[] = ['build', 'leave', 'return'];

const KIND_OF: Readonly<Record<string, StrategyKind>> = {
  'start-tiny': 'build',
  'anchor-prayer': 'build',
  'if-then': 'build',
  'prepare-place': 'build',
  bundle: 'build',
  season: 'build',
  company: 'build',
  'block-sin': 'leave',
  'know-weak': 'leave',
  'ride-wave': 'leave',
  'follow-good': 'leave',
  'never-twice': 'return',
  'make-up': 'return',
  'self-review': 'return',
};

/** The family of a strategy (a strategy added later without one counts as «بناء»). */
export function strategyKind(key: string): StrategyKind {
  return KIND_OF[key] ?? 'build';
}

/**
 * True when «طبّقها على عادة» fits the strategy: it shapes a habit's loop (cue, routine, obstacle, «إذا… فإني…»). The
 * «ترك» strategies open «تخفّف» instead, and «أتبِع السيئة الحسنة» its list of easy deeds.
 */
export function appliesToHabit(key: string): boolean {
  return strategyKind(key) !== 'leave';
}
