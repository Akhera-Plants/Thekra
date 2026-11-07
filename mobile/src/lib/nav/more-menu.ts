/**
 * «المزيد» (owner round 5, §1 IA; docs/plan/2026-11-07-owner-round-5.md): the screens that are not a tab, in three
 * groups and in the plan's order, the settings rows last (the app has no settings tab any more). Every row is a
 * feature of the shared navigation map (practice-core `nav-map.ts`): its route comes from there, and a test holds its
 * Arabic and English label to the map's names, so the app and the website cannot drift apart again.
 *
 * `members` rows open «تسجيل الدخول» for a guest first (then the screen). Icons are chosen in the screen; this list is
 * pure so a test can check it.
 */

import type { Href } from 'expo-router';
import { navFeature } from '@thekra/practice-core';

/** The nav-map keys «المزيد» lists. */
export type MoreKey =
  | 'leave-sin'
  | 'people'
  | 'circles'
  | 'saved'
  | 'browse'
  | 'branches'
  | 'strategies'
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
  key: 'mine' | 'read' | 'settings';
  /** i18n key of the group heading (`settings`: the nav-map name «الإعدادات»). */
  titleKey: string;
  items: MoreItem[];
}

function item(key: MoreKey, members: boolean): MoreItem {
  const app = navFeature(key)?.app;
  if (!app) throw new RangeError(`No app route for ${key}`);
  return { key, labelKey: `more.items.${key}`, href: app as Href, path: app, members };
}

export const MORE_MENU: readonly MoreGroup[] = [
  {
    key: 'mine',
    titleKey: 'more.groups.mine',
    items: [item('leave-sin', true), item('people', true), item('circles', true), item('saved', true)],
  },
  {
    key: 'read',
    titleKey: 'more.groups.read',
    items: [item('browse', false), item('branches', false), item('strategies', true)],
  },
  {
    key: 'settings',
    titleKey: 'more.items.settings',
    items: [
      item('account', false),
      item('privacy', false),
      item('notifications', true),
      item('prayer-times', true),
      item('appearance', false),
      item('about', false),
    ],
  },
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
