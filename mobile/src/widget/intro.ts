/**
 * «أضف ورد اليوم إلى شاشتك» (owner round 5, F-24 a): one line in «ورد اليوم», shown once, on Android only, after the
 * member has logged habits on 3 different days; never again once seen or dismissed, and not when the wird widget is
 * already on the home screen. Pure (no React Native), so the rule is tested in Node; `WidgetIntro.tsx` draws it.
 */
import type { Store } from '@thekra/practice-core';

/** Days of logging before the line may show. */
export const WIDGET_INTRO_AFTER_DAYS = 3;
/** AsyncStorage key: set once the line was shown or dismissed. */
export const WIDGET_INTRO_KEY = 'thekra.widget.intro.v1';

/** Distinct days on which any habit was logged (an amount above zero). */
export function loggedDays(store: Pick<Store, 'plans'>): number {
  const days = new Set<string>();
  for (const plan of store.plans) {
    for (const [day, amount] of Object.entries(plan.log ?? {})) if (amount > 0) days.add(day);
  }
  return days.size;
}

export interface WidgetIntroState {
  os: string;
  /** From {@link loggedDays}. */
  days: number;
  /** The line was shown (or dismissed) before. */
  seen: boolean;
  /** A wird widget is already on the home screen (unknown counts as not placed). */
  placed: boolean;
}

export function shouldShowWidgetIntro({ os, days, seen, placed }: WidgetIntroState): boolean {
  return os === 'android' && !seen && !placed && days >= WIDGET_INTRO_AFTER_DAYS;
}
