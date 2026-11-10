/**
 * Where «جرّبها» leads in the app for each strategy (practice-core `STRATEGIES`), and the device switch it turns on
 * first (opt-in: only on this explicit tap). Kept apart from the screen so a test can check every mapping.
 *
 * Owner round 3: «أتبِع السيئةَ الحسنة» opens a short list of easy, high-reward good deeds (`kind: 'deeds'`), never
 * «تخفَّف»; «لا تفوّتها مرتين» is not listed (it appears in context the day after a habit is missed).
 */

import type { Href } from 'expo-router';
import { anchoredPrayerOf, minimumOf, strategyAppliesToHabit, type HeartPrefs, type Plan, type StrategyAction } from '@thekra/practice-core';

// The families «بناء / ترك / عودة» (C-18 a), the unlisted «لا تفوّتها مرتين», which loop answer a strategy writes and the
// save itself are shared with the website: practice-core `strategies.ts` (`STRATEGY_KINDS`, `listedStrategies`,
// `strategyApplyField`, `applyStrategyToPlan`).

/** True when «طبّقها على عادة» applies the strategy to a habit's loop (practice-core decides). */
export function appliesToHabit(key: string): boolean {
  return strategyAppliesToHabit(key);
}

export type StrategyTarget = { kind: 'screen'; href: Href; heart?: Partial<HeartPrefs> } | { kind: 'deeds' };

export function strategyTarget(action: StrategyAction, key?: string): StrategyTarget {
  if (key === 'follow-good') return { kind: 'deeds' };
  const screen = (href: Href, heart?: Partial<HeartPrefs>): StrategyTarget => (heart ? { kind: 'screen', href, heart } : { kind: 'screen', href });
  switch (action) {
    case 'add':
      return screen('/practice/add');
    // The round-5 places (practice-core nav-map): «عاداتي» tabs by `?tab=`.
    case 'habits':
      return screen('/habits?tab=habits');
    case 'wird':
      return screen('/habits?tab=today');
    case 'record':
      return screen('/habits?tab=record');
    case 'seasons':
      // No «مواسم الخير» page (F-17): the occasions are on the «سجلّي» calendar.
      return screen('/habits?tab=record');
    case 'moment':
      return screen('/practice/moment');
    case 'leaveSin':
      return screen('/practice/sin-program');
    case 'friends':
      return screen({ pathname: '/practice/kinship', params: { circle: 'friends' } });
    case 'pledges':
      // No pledge page (F-08 a): «إذا… فإني…» is written in «محاسبتي».
      return screen('/habits?tab=review');
    case 'evening':
      return screen('/habits?tab=review', { eveningReview: true });
  }
}

/** The words a suggestion needs: the habit's amount in its own unit, and a prayer's name. */
export interface SuggestionWords {
  amount: (n: number) => string;
  prayer: (prayer: NonNullable<ReturnType<typeof anchoredPrayerOf>>) => string;
}

/**
 * «طبّقها على عادة» (round 7, C2; same as the website's `applySuggestion`): the answer offered for the chosen habit,
 * built from the habit itself — its «القدر الأدنى» for «ابدأ صغيرًا جدًا» and «إذا… فإني…», the prayer it is already
 * tied to for «اربطها بصلاة», the make-up window for «اقضِ ما فاتك». Empty when the habit says nothing about it: the
 * member writes it, with the strategy's example as the hint. `t` reads `practice.strategies.<key>`.
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
