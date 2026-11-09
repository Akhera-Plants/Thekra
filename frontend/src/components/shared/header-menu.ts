/**
 * The site header (owner round 6, C-07 b / C-05 a; docs/plan/2026-11-09-owner-round-6.md §1), built from practice-core
 * `WEB_HEADER` and `WEB_ACCOUNT_MENU`: the links «الرئيسية · الطاعات · تخفّف من ذنب · شعب الإيمان · عاداتي», then
 * «المزيد ▾» (الاستراتيجيات، المحفوظات، «رفقة (في التطبيق)»), then the account avatar menu (الحساب، الإعدادات،
 * تسجيل الخروج). An item of «المزيد» is never also a header link, and the settings live only in the account menu.
 * Every item is a `NAV_FEATURES` key: its route comes from the shared map, and `header-menu.spec.ts` checks the labels
 * in the message files against it. On a phone the drawer holds the same links and «المزيد» items.
 */
import { navFeature, WEB_ACCOUNT_MENU, WEB_HEADER } from '@thekra/practice-core';

export type HeaderLinkKey = 'home' | 'good-deeds' | 'sins' | 'branches' | 'habits';
export type HeaderMoreKey = 'strategies' | 'saved' | 'circles';
export type HeaderAccountKey = 'account' | 'settings';
export type HeaderMenuKey = HeaderLinkKey | HeaderMoreKey;

export interface HeaderMenuItem<K extends string = HeaderMenuKey> {
  key: K;
  /** The web route; null for «رفقة», which lives in the app (it opens a short note instead). */
  href: string | null;
}

function item<K extends string>(key: K): HeaderMenuItem<K> {
  const feature = navFeature(key);
  if (!feature) throw new RangeError(`Unknown nav feature: ${key}`);
  return { key, href: feature.web };
}

export const HEADER_LINKS: readonly HeaderMenuItem<HeaderLinkKey>[] = (WEB_HEADER.links as readonly HeaderLinkKey[]).map(item);
export const HEADER_MORE: readonly HeaderMenuItem<HeaderMoreKey>[] = (WEB_HEADER.more as readonly HeaderMoreKey[]).map(item);
/**
 * The account menu's pages. «الحساب» and «الإعدادات» share the settings page in the map; «الحساب» opens it at its
 * account group (`#account`).
 */
export const HEADER_ACCOUNT: readonly HeaderMenuItem<HeaderAccountKey>[] = (WEB_ACCOUNT_MENU as readonly HeaderAccountKey[]).map(
  (key) => {
    const entry = item(key);
    return key === 'account' && entry.href ? { key, href: `${entry.href}#account` } : entry;
  },
);

export const HEADER_MENU_ITEMS: readonly HeaderMenuItem[] = [...HEADER_LINKS, ...HEADER_MORE];

/**
 * The item that marks the current page (locale prefix already removed), or null. The deepest route wins:
 * «الاستراتيجيات» lives under `/practice` but is an item of its own; every other practice page is «عاداتي», and «تخفّف»
 * (`/practice/leave-sin`) belongs to «عاداتي» too (a program is a habit of type «تخفّف»). «الرئيسية» marks only `/`.
 */
export function currentHeaderItem(pathname: string): HeaderMenuKey | null {
  if (pathname === '/' || pathname === '') return 'home';
  const under = (href: string) => href !== '/' && (pathname === href || pathname.startsWith(`${href}/`));
  const hits = HEADER_MENU_ITEMS.filter((entry): entry is HeaderMenuItem & { href: string } => entry.href !== null && under(entry.href));
  hits.sort((a, b) => b.href.length - a.href.length);
  return hits[0]?.key ?? null;
}

/** True when the current page is one of «المزيد» (the trigger is then marked). */
export function isMoreCurrent(current: HeaderMenuKey | null): boolean {
  return current !== null && HEADER_MORE.some((entry) => entry.key === current);
}
