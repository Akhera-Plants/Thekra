/**
 * The site header's one menu (owner round 5, W-10 a / W-12 b; docs/plan/2026-11-07-owner-round-5.md §1): the same list
 * for a visitor and a member, in two groups — «أبواب الخير» (تخفَّف، الطاعات، شعب الإيمان، تصفّح النصوص) then «للأعضاء»
 * (عاداتي، أهلي وناسي، المحفوظات، الإعدادات، «رفقة (في التطبيق)»). Every item is a practice-core `NAV_FEATURES` key: its
 * route comes from the shared map, and `header-menu.spec.ts` checks the labels in the message files against it.
 */
import { navFeature } from '@thekra/practice-core';

// Round 6 (practice-core nav-map): «تصفّح النصوص» and «أهلي وناسي» are gone. The full round-6 header (WEB_HEADER,
// WEB_ACCOUNT_MENU) is for the UI work; this list only drops the removed items.
export type HeaderMenuKey = 'leave-sin' | 'good-deeds' | 'branches' | 'habits' | 'saved' | 'settings' | 'circles';

export interface HeaderMenuItem {
  key: HeaderMenuKey;
  /** The web route; null for «رفقة», which lives in the app (it opens a short note instead). */
  href: string | null;
}

export interface HeaderMenuGroup {
  key: 'doors' | 'members';
  items: readonly HeaderMenuItem[];
}

function item(key: HeaderMenuKey): HeaderMenuItem {
  const feature = navFeature(key);
  if (!feature) throw new RangeError(`Unknown nav feature: ${key}`);
  return { key, href: feature.web };
}

export const HEADER_MENU: readonly HeaderMenuGroup[] = [
  { key: 'doors', items: (['leave-sin', 'good-deeds', 'branches'] as const).map(item) },
  { key: 'members', items: (['habits', 'saved', 'settings', 'circles'] as const).map(item) },
];

export const HEADER_MENU_ITEMS: readonly HeaderMenuItem[] = HEADER_MENU.flatMap((group) => group.items);

/**
 * The item that marks the current page (locale prefix already removed), or null. The deepest route wins: «أهلي وناسي»
 * and «تخفَّف» live under `/practice` but are items of their own; every other practice page is «عاداتي».
 */
export function currentHeaderItem(pathname: string): HeaderMenuKey | null {
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const hits = HEADER_MENU_ITEMS.filter((entry): entry is HeaderMenuItem & { href: string } => entry.href !== null && under(entry.href));
  hits.sort((a, b) => b.href.length - a.href.length);
  return hits[0]?.key ?? null;
}
