/**
 * The five tabs of «عاداتي» (round 6 §2, docs/plan/2026-11-09-owner-round-6.md): «اليوم · العادات · الأعمال الدورية ·
 * محاسبتي · سجلّي». Their keys and web routes come from practice-core `HABITS_TABS` / `NAV_FEATURES`; labels are the
 * nav map's names (`nav.menuItems.<key>` in the messages; `habits-tabs.spec.ts` checks them).
 */
import { HABITS_TABS as NAV_HABITS_TABS, navFeature } from '@thekra/practice-core';

export type HabitsTabKey = 'today' | 'my-habits' | 'periodic' | 'review' | 'record';

function route(key: string): string {
  const web = navFeature(key)?.web;
  if (!web) throw new RangeError(`No web route for ${key}`);
  return web;
}

export const HABITS_TABS: readonly { key: HabitsTabKey; href: string }[] = NAV_HABITS_TABS.map((key) => ({
  key: key as HabitsTabKey,
  href: route(key),
}));

/** The tab a path belongs to (locale prefix removed), or null outside the five. A habit page belongs to «العادات». */
export function habitsTabOf(pathname: string): HabitsTabKey | null {
  const exact = HABITS_TABS.find((tab) => tab.href === pathname);
  if (exact) return exact.key;
  return HABITS_TABS.find((tab) => tab.href !== '/practice' && pathname.startsWith(`${tab.href}/`))?.key ?? null;
}
