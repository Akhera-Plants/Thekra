/**
 * App-only practice preferences, stored next to the practice-core Store (AsyncStorage
 * `thekra.practice.prefs.v1`). Never synced: reminder switches and times, the reminder rule per plan,
 * the «فروضي وأدواري» answers. Parsing is defensive and never throws.
 */

import { isValidTime, validateRule, type LocalTime, type Rule } from '@thekra/practice-core';

export const PREFS_KEY = 'thekra.practice.prefs.v1';

export const ROLE_KEYS = ['parents', 'spouse', 'children', 'work', 'study', 'home'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export interface PracticePrefs {
  v: 1;
  /** Local notifications for habit plans. */
  habitReminders: boolean;
  /** Reminder rule per plan id; when missing the catalog habit's `defaultRule` applies. */
  planRules: Record<string, Rule>;
  kinshipReminders: boolean;
  /** Relatives' nicknames in the notification body. Off by default: notifications show on the lock screen. */
  kinshipShowNames: boolean;
  kinshipTime: LocalTime;
  /** Sin-program reminders. Their title is always the generic «تذكرة من ذكرى». */
  sinReminders: boolean;
  sinReminderTime: LocalTime;
  /** «فروضي وأدواري»: free minutes per day after obligations and roles. */
  freeMinutesPerDay: number | null;
  roles: RoleKey[];
}

export const DEFAULT_PREFS: PracticePrefs = {
  v: 1,
  habitReminders: false,
  planRules: {},
  kinshipReminders: false,
  kinshipShowNames: false,
  kinshipTime: '18:00',
  sinReminders: false,
  sinReminderTime: '21:00',
  freeMinutesPerDay: null,
  roles: [],
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parsePrefs(json: unknown): PracticePrefs {
  let raw: unknown = json;
  if (typeof json === 'string') {
    try {
      raw = JSON.parse(json);
    } catch {
      return { ...DEFAULT_PREFS, planRules: {} };
    }
  }
  if (!isRecord(raw) || raw.v !== 1) return { ...DEFAULT_PREFS, planRules: {} };
  const bool = (k: keyof PracticePrefs) => (typeof raw[k] === 'boolean' ? (raw[k] as boolean) : (DEFAULT_PREFS[k] as boolean));
  const time = (k: 'kinshipTime' | 'sinReminderTime') => (isValidTime(raw[k]) ? (raw[k] as string) : DEFAULT_PREFS[k]);
  const planRules: Record<string, Rule> = {};
  if (isRecord(raw.planRules)) {
    for (const [id, rule] of Object.entries(raw.planRules)) {
      if (validateRule(rule) === null) planRules[id] = rule as Rule;
    }
  }
  const free = raw.freeMinutesPerDay;
  return {
    v: 1,
    habitReminders: bool('habitReminders'),
    planRules,
    kinshipReminders: bool('kinshipReminders'),
    kinshipShowNames: bool('kinshipShowNames'),
    kinshipTime: time('kinshipTime'),
    sinReminders: bool('sinReminders'),
    sinReminderTime: time('sinReminderTime'),
    freeMinutesPerDay:
      typeof free === 'number' && Number.isFinite(free) && free >= 0 && free <= 24 * 60 ? Math.round(free) : null,
    roles: Array.isArray(raw.roles)
      ? (raw.roles.filter((r) => (ROLE_KEYS as readonly string[]).includes(r as string)) as RoleKey[])
      : [],
  };
}
