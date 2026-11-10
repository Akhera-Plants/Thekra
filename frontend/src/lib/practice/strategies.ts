import { anchoredPrayerOf, minimumOf, navFeature, type HeartPrefs, type Plan, type StrategyAction } from '@thekra/practice-core';

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

// The families «بناء / ترك / عودة», the unlisted «لا تفوّتها مرتين» and «طبّقها على عادة» (which loop answer each
// strategy writes, and the save itself) are shared with the app: practice-core `strategies.ts` (`STRATEGY_KINDS`,
// `listedStrategies`, `strategyApplyField`, `applyStrategyToPlan`).

/** The words a suggestion needs: the habit's amount in its own unit, and a prayer's name. */
export interface SuggestionWords {
  amount: (n: number) => string;
  prayer: (prayer: NonNullable<ReturnType<typeof anchoredPrayerOf>>) => string;
}

/**
 * «طبّقها على عادة» (round 7, C2): the answer offered for the chosen habit, built from the habit itself — its own
 * «القدر الأدنى» for «ابدأ صغيرًا جدًا» and «إذا… فإني…», the prayer it is already tied to for «اربطها بصلاة», the
 * app's make-up window for «اقضِ ما فاتك». Empty when the habit says nothing about it («هيّئ مكانك», «اجمعها بما تحب»,
 * a habit not tied to a prayer): the member writes it, with the strategy's example as the hint. `t` reads
 * `practice.strategies.items.<key>.suggest`.
 */
export function applySuggestion(key: string, plan: Plan, words: SuggestionWords, t: (key: string, values?: Record<string, string>) => string): string {
  switch (key) {
    case 'start-tiny':
    case 'if-then':
      return t(`items.${key}.suggest`, { amount: words.amount(minimumOf(plan)) });
    case 'anchor-prayer': {
      const prayer = anchoredPrayerOf(plan);
      return prayer ? t('items.anchor-prayer.suggest', { prayer: words.prayer(prayer) }) : '';
    }
    case 'make-up':
      return t('items.make-up.suggest');
    default:
      return '';
  }
}

/** A habit's name inside a question: in «» (“” in English), unless the name already carries its own quotes. */
export function quoted(title: string, english: boolean): string {
  if (/[«»“”"]/.test(title)) return title;
  return english ? `“${title}”` : `«${title}»`;
}
