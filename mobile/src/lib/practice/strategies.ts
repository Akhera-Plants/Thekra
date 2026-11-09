/**
 * Where «جرّبها» leads in the app for each strategy (practice-core `STRATEGIES`), and the device switch it turns on
 * first (opt-in: only on this explicit tap). Kept apart from the screen so a test can check every mapping.
 *
 * Owner round 3: «أتبِع السيئةَ الحسنة» opens a short list of easy, high-reward good deeds (`kind: 'deeds'`), never
 * «تخفَّف»; «لا تفوّتها مرتين» is not listed (it appears in context the day after a habit is missed).
 */

import type { Href } from 'expo-router';
import { strategyAppliesToHabit, type HeartPrefs, type StrategyAction } from '@thekra/practice-core';
import type { HabitLoopField, LoopDraft } from './loops';

// The families «بناء / ترك / عودة» (C-18 a), the unlisted «لا تفوّتها مرتين» and whether «طبّقها على عادة» applies are
// shared with the website: practice-core `strategies.ts` (`STRATEGY_KINDS`, `listedStrategies`, `strategyAppliesToHabit`).

/**
 * «طبّقها على عادة»: the question of the habit loop (src/lib/practice/loops.ts) a building or returning strategy fills.
 * A leaving strategy has none: it opens its own place (`strategyTarget`). The member reviews every answer in the loop
 * builder before it is saved; nothing is written without that.
 */
export const APPLY_FIELD: Readonly<Record<string, HabitLoopField>> = {
  'start-tiny': 'routine',
  'anchor-prayer': 'cue',
  'if-then': 'ifThen',
  'prepare-place': 'cue',
  bundle: 'reward',
  season: 'cue',
  company: 'craving',
  'make-up': 'ifThen',
  'self-review': 'reward',
};

/** True when «طبّقها على عادة» applies the strategy to a habit's loop (practice-core decides; every such one has a field). */
export function appliesToHabit(key: string): boolean {
  return strategyAppliesToHabit(key) && APPLY_FIELD[key] !== undefined;
}

/**
 * The loop draft to review: the habit's own answers (its first loop, or empty), with the strategy's question filled by
 * its example when that question has no answer yet. A written answer is never replaced.
 */
export function applyStrategyDraft(key: string, current: LoopDraft, example: string): LoopDraft {
  const field = APPLY_FIELD[key];
  if (!field) return { ...current };
  const existing = (current[field] ?? '').trim();
  return existing ? { ...current } : { ...current, [field]: exampleAnswer(example) };
}

/** The example line as a loop answer: without its «مثال:» / «Example:» lead (same as the website). */
export function exampleAnswer(example: string): string {
  return example.replace(/^\s*(?:مثال|Example)\s*[:：]\s*/u, '').trim();
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
