/**
 * The four tabs of «عاداتي» (round 5, §1): their nav-map keys and web routes. Labels are the nav map's names
 * (`nav.menuItems.<key>` in the messages; `habits-tabs.spec.ts` checks them).
 */
import { navFeature } from '@thekra/practice-core';

export type HabitsTabKey = 'wird' | 'periodic' | 'review' | 'record';

function route(key: HabitsTabKey): string {
  const web = navFeature(key)?.web;
  if (!web) throw new RangeError(`No web route for ${key}`);
  return web;
}

export const HABITS_TABS: readonly { key: HabitsTabKey; href: string }[] = (['wird', 'periodic', 'review', 'record'] as const).map(
  (key) => ({ key, href: route(key) }),
);

/** The tab a path belongs to (locale prefix removed), or null outside the four. */
export function habitsTabOf(pathname: string): HabitsTabKey | null {
  const exact = HABITS_TABS.find((tab) => tab.href === pathname);
  if (exact) return exact.key;
  return HABITS_TABS.find((tab) => tab.href !== '/practice' && pathname.startsWith(`${tab.href}/`))?.key ?? null;
}
