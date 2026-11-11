/**
 * Where the Thekra phone app can be installed. A constant on purpose, like the extension's store page in the app
 * (`mobile/src/lib/site.ts`): a new env var would have to be added to CI, backend/.env.example and
 * docs/deploy/VERCEL.md (AGENTS.md), and these are two fixed public addresses.
 *
 * Both are `null` because the app is not published yet (mobile/RELEASE.md §2-3): no store address exists, and none
 * may be invented. The page then says so plainly instead of showing a dead button. Fill each one with the store's
 * page address the day it goes live and the buttons appear everywhere (the «صحبة» dialog and the invite page).
 */
export const APP_STORE_URL: string | null = null;
export const PLAY_STORE_URL: string | null = null;

export interface AppStoreLink {
  key: 'appStore' | 'playStore';
  href: string;
}

/** The store buttons to show: only the stores that have an address. */
export function appStoreLinks(): AppStoreLink[] {
  const links: AppStoreLink[] = [];
  if (APP_STORE_URL) links.push({ key: 'appStore', href: APP_STORE_URL });
  if (PLAY_STORE_URL) links.push({ key: 'playStore', href: PLAY_STORE_URL });
  return links;
}
