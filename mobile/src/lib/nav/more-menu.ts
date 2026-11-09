/**
 * «المزيد» (round 6 §1, docs/plan/2026-11-09-owner-round-6.md; practice-core `APP_MORE`): the web header's «المزيد»
 * (الاستراتيجيات، المحفوظات، رفقة) and «الحديقة» (app only), then the settings rows. No «تصفّح النصوص» and no people
 * page. Every row is a feature of the shared navigation map (practice-core `nav-map.ts`): its route comes from there,
 * and a test holds its Arabic and English label to the map's names, so the app and the website cannot drift apart.
 *
 * `members` rows open «تسجيل الدخول» for a guest first (then the screen). Icons are chosen in the screen; this list is
 * pure so a test can check it.
 */

import type { Href } from 'expo-router';
import { APP_MORE, navFeature } from '@thekra/practice-core';

/** The nav-map keys «المزيد» lists (practice-core `APP_MORE`). */
export type MoreKey =
  | 'strategies'
  | 'saved'
  | 'circles'
  | 'garden'
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'prayer-times'
  | 'appearance'
  | 'about';

export interface MoreItem {
  /** The feature's key in practice-core `NAV_FEATURES`. */
  key: MoreKey;
  /** i18n key of the label; equal to the nav-map name in both languages (tested). */
  labelKey: string;
  href: Href;
  /** The path handed to sign-in as `next`. */
  path: string;
  members: boolean;
}

export interface MoreGroup {
  key: 'mine' | 'settings';
  /** i18n key of the group heading (`settings`: the nav-map name «الإعدادات»). */
  titleKey: string;
  items: MoreItem[];
}

/** Rows a guest may open without signing in (reading and account rows). */
const OPEN_TO_GUESTS: ReadonlySet<MoreKey> = new Set(['account', 'privacy', 'appearance', 'about']);

function item(key: MoreKey): MoreItem {
  const app = navFeature(key)?.app;
  if (!app) throw new RangeError(`No app route for ${key}`);
  return { key, labelKey: `more.items.${key}`, href: app as Href, path: app, members: !OPEN_TO_GUESTS.has(key) };
}

export const MORE_MENU: readonly MoreGroup[] = [
  { key: 'mine', titleKey: 'more.groups.mine', items: APP_MORE.mine.map((k) => item(k as MoreKey)) },
  { key: 'settings', titleKey: 'more.items.settings', items: APP_MORE.settings.map((k) => item(k as MoreKey)) },
];

/** What a tap does: open the screen, or ask a guest to sign in first (then the screen). */
export function moreAction(entry: MoreItem, signedIn: boolean): { kind: 'open'; href: Href } | { kind: 'signIn'; next: string } {
  return entry.members && !signedIn ? { kind: 'signIn', next: entry.path } : { kind: 'open', href: entry.href };
}

/** The bottom tabs, in reading order, with the nav-map feature each one is (labels tested against the map). */
export const TABS: readonly { name: 'index' | 'habits' | 'more'; key: 'home' | 'habits' | 'more'; labelKey: string; members: boolean }[] = [
  { name: 'index', key: 'home', labelKey: 'tabs.home', members: false },
  { name: 'habits', key: 'habits', labelKey: 'tabs.habits', members: true },
  { name: 'more', key: 'more', labelKey: 'tabs.more', members: false },
];
