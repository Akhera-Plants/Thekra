/**
 * The side menu (owner, 2026-11-01): the screens that are not a tab, under short group headings, in this order. Each
 * item is a route; `members` items open «تسجيل الدخول» for a guest first (practice is for members; «استكشف النصوص» and
 * «مواسم الخير» stay public, as on the website). «تخفَّف» is not here: it is the home door «تخفَّف من معصية» and a section
 * of «عاداتي», so it has one way in. «مواسم الخير» and «استكشف النصوص» moved here from the home page. Icons are chosen
 * in the component; this list stays pure so a test can check it.
 */

import type { Href } from 'expo-router';

export type SideMenuKey = 'periodic' | 'reviews' | 'strategies' | 'circles' | 'browse' | 'saved' | 'seasons';

export interface SideMenuItem {
  key: SideMenuKey;
  /** i18n key of the label (the screen's own title, so a screen never has two names). */
  labelKey: string;
  href: Href;
  /** The path handed to sign-in as `next`. */
  path: string;
  members: boolean;
}

export interface SideMenuGroup {
  key: 'deeds' | 'together' | 'reading';
  titleKey: string;
  items: SideMenuItem[];
}

const item = (key: SideMenuKey, labelKey: string, path: string, members = true): SideMenuItem => ({
  key,
  labelKey,
  href: path as Href,
  path,
  members,
});

export const SIDE_MENU: readonly SideMenuGroup[] = [
  {
    key: 'deeds',
    titleKey: 'menu.groups.deeds',
    items: [
      item('periodic', 'practice.periodic.title', '/practice/periodic'),
      item('reviews', 'record.reviews', '/practice/reviews'),
      item('strategies', 'record.strategies', '/practice/strategies'),
    ],
  },
  { key: 'together', titleKey: 'menu.groups.together', items: [item('circles', 'circles.title', '/circles')] },
  {
    key: 'reading',
    titleKey: 'menu.groups.reading',
    items: [
      item('browse', 'browse.title', '/browse', false),
      item('saved', 'favorites.title', '/favorites'),
      item('seasons', 'calendar.title', '/practice/calendar', false),
    ],
  },
];

/** What a tap does: open the screen, or ask a guest to sign in first (then the screen). */
export function sideMenuAction(entry: SideMenuItem, signedIn: boolean): { kind: 'open'; href: Href } | { kind: 'signIn'; next: string } {
  return entry.members && !signedIn ? { kind: 'signIn', next: entry.path } : { kind: 'open', href: entry.href };
}

/**
 * Where the panel sits and from where it slides: the inline-end side, where the menu button is (the left in Arabic,
 * the right in English), so the panel comes out of the button that opened it. `hiddenX` is the translateX that puts it
 * just off that edge (transforms do not flip with the layout direction).
 */
export function drawerOffset(rtl: boolean, width: number): { side: 'left' | 'right'; hiddenX: number } {
  return rtl ? { side: 'left', hiddenX: -width } : { side: 'right', hiddenX: width };
}

/** Panel width: most of a phone, capped on tablets. */
export function drawerWidth(screenWidth: number): number {
  return Math.round(Math.min(screenWidth * 0.84, 340));
}
