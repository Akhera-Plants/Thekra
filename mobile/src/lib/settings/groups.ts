/**
 * Settings as a short list of groups (owner, 2026-11-01: «categorize instead of one long scroll»); each group opens its
 * own screen. The order is the order on the Settings tab. Kept pure so a test can check that every group has a screen
 * and that no group is listed twice.
 */

import type { Href } from 'expo-router';

export type SettingsGroupKey = 'account' | 'notifications' | 'prayer' | 'privacy' | 'appearance' | 'about';

export interface SettingsGroupEntry {
  key: SettingsGroupKey;
  titleKey: string;
  href: Href;
  /** A guest is asked to sign in first (prayer times feed the members-only practice reminders). */
  members: boolean;
}

export const SETTINGS_GROUPS: readonly SettingsGroupEntry[] = [
  { key: 'account', titleKey: 'settings.groups.account', href: '/settings/account', members: false },
  { key: 'notifications', titleKey: 'settings.groups.notifications', href: '/settings/notifications', members: true },
  { key: 'prayer', titleKey: 'prayerTimes.title', href: '/practice/prayer-times', members: true },
  { key: 'privacy', titleKey: 'settings.groups.privacy', href: '/settings/privacy', members: false },
  { key: 'appearance', titleKey: 'settings.groups.appearance', href: '/settings/appearance', members: false },
  { key: 'about', titleKey: 'settings.about', href: '/settings/about', members: false },
];
