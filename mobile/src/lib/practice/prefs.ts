/**
 * App-only practice preferences, stored next to the practice-core Store (AsyncStorage
 * `thekra.practice.prefs.v1`). Never synced: reminder switches and times, and the «فروضي وأدواري» roles.
 * The reminder rule of a plan now lives on the plan (`plan.rule`, synced) and the free minutes in the Store
 * settings (`settings.freeMinutesPerDay`, synced); `legacyPrefs` reads the old fields once to migrate them.
 * Parsing is defensive and never throws.
 */

import { isValidTime, validateRule, type LocalTime, type Rule } from '@thekra/practice-core';

export const PREFS_KEY = 'thekra.practice.prefs.v1';

export const ROLE_KEYS = ['parents', 'spouse', 'children', 'work', 'study', 'home'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export interface PracticePrefs {
  v: 1;
  /**
   * Local notifications for habit plans. On by default (the add flow asks for reminder times); the permission is
   * asked when the first habit is added. A stored value, on or off, is always kept.
   */
  habitReminders: boolean;
  kinshipReminders: boolean;
  /** Relatives' nicknames in the notification body. Off by default: notifications show on the lock screen. */
  kinshipShowNames: boolean;
  kinshipTime: LocalTime;
  /** Sin-program reminders. Their title is always the generic «تذكرة من ذكرى». */
  sinReminders: boolean;
  sinReminderTime: LocalTime;
  /** «فروضي وأدواري» roles (the free minutes are in the Store settings). */
  roles: RoleKey[];
  /** Remember the vault key in the device keystore («تذكّر على هذا الجهاز»). Off by default. */
  rememberVaultKey: boolean;
}

export const DEFAULT_PREFS: PracticePrefs = {
  v: 1,
  habitReminders: true,
  kinshipReminders: false,
  kinshipShowNames: false,
  kinshipTime: '18:00',
  sinReminders: false,
  sinReminderTime: '21:00',
  roles: [],
  rememberVaultKey: false,
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
      return { ...DEFAULT_PREFS };
    }
  }
  if (!isRecord(raw) || raw.v !== 1) return { ...DEFAULT_PREFS };
  const bool = (k: keyof PracticePrefs) => (typeof raw[k] === 'boolean' ? (raw[k] as boolean) : (DEFAULT_PREFS[k] as boolean));
  const time = (k: 'kinshipTime' | 'sinReminderTime') => (isValidTime(raw[k]) ? (raw[k] as string) : DEFAULT_PREFS[k]);
  return {
    v: 1,
    habitReminders: bool('habitReminders'),
    kinshipReminders: bool('kinshipReminders'),
    kinshipShowNames: bool('kinshipShowNames'),
    kinshipTime: time('kinshipTime'),
    sinReminders: bool('sinReminders'),
    sinReminderTime: time('sinReminderTime'),
    rememberVaultKey: bool('rememberVaultKey'),
    roles: Array.isArray(raw.roles)
      ? (raw.roles.filter((r) => (ROLE_KEYS as readonly string[]).includes(r as string)) as RoleKey[])
      : [],
  };
}

/**
 * True when adding a habit should ask for the notification permission now: it is the first habit and habit
 * reminders are on (the default). Someone who turned them off is never asked here.
 */
export function shouldAskOnFirstHabit(planCountBefore: number, prefs: Pick<PracticePrefs, 'habitReminders'>): boolean {
  return planCountBefore === 0 && prefs.habitReminders;
}

/** Fields of the first prefs version that moved into the synced Store (migrated once by practice-store). */
export function legacyPrefs(json: unknown): { planRules: Record<string, Rule>; freeMinutesPerDay: number | null } {
  let raw: unknown = json;
  if (typeof json === 'string') {
    try {
      raw = JSON.parse(json);
    } catch {
      raw = null;
    }
  }
  const planRules: Record<string, Rule> = {};
  if (!isRecord(raw)) return { planRules, freeMinutesPerDay: null };
  if (isRecord(raw.planRules)) {
    for (const [id, rule] of Object.entries(raw.planRules)) if (validateRule(rule) === null) planRules[id] = rule as Rule;
  }
  const free = raw.freeMinutesPerDay;
  return {
    planRules,
    freeMinutesPerDay: typeof free === 'number' && Number.isInteger(free) && free >= 0 && free <= 1440 ? free : null,
  };
}
