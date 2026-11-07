/**
 * App-only practice preferences, stored next to the practice-core Store (AsyncStorage
 * `thekra.practice.prefs.v1`). Never synced: reminder switches and times («التنبيهات»: practice-core `NotificationPrefs`), the «فروضي وأدواري» roles, the
 * sin-program lock and «إظهار التاريخ الهجري».
 * The reminder rule of a plan now lives on the plan (`plan.rule`, synced) and the free minutes in the Store
 * settings (`settings.freeMinutesPerDay`, synced); `legacyPrefs` reads the old fields once to migrate them.
 * Parsing is defensive and never throws.
 */

import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TODAY_TEXT_SOURCE,
  isValidTime,
  parseMyReminders,
  parsePrayerCache,
  parsePrayerSettings,
  parseTodayTextSource,
  validateRule,
  type LocalTime,
  type MyReminder,
  type PrayerCache,
  type PrayerSettings,
  type Rule,
  type TodayTextSource,
} from '@thekra/practice-core';

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
  /**
   * The reminder of «محاسبة المساء» (redesign §4.4; owner round 4): once a day while a habit is not done. Off by
   * default; Settings turns it on and off with the evening review card, and `eveningTime` follows the card's
   * `HeartPrefs.eveningFrom`.
   */
  eveningNudge: boolean;
  eveningTime: LocalTime;
  /**
   * The weekly review's reminder (the keys keep their first name, Friday's), on the review day the heart keeps
   * (`HeartPrefs.reviewDay`). On by default; Settings switches it with the weekly review card.
   */
  fridayReminder: boolean;
  fridayTime: LocalTime;
  /** «فروضي وأدواري» roles (the free minutes are in the Store settings). */
  roles: RoleKey[];
  /**
   * Unused since 2026-11-01 (the vault key is always kept behind biometrics, vault-runner.ts); parsed so older prefs
   * stay readable.
   */
  rememberVaultKey: boolean;
  /** Unused since 2026-11-01 («تخفَّف» always opens with the fingerprint / face); parsed for older prefs. */
  sinLock: boolean;
  /** «شعبة الأسبوع» on «ورد اليوم»: only for a member who chose to study the branches of faith. Off by default. */
  weekBranch: boolean;
  /** «إظهار التاريخ الهجري»: the Hijri date next to the Gregorian one on «ورد اليوم» and «سجلّي». Off by default. */
  showHijri: boolean;
  /**
   * «مناسبة قريبة» (owner round 5, F-17): one reminder the evening before a coming occasion of the catalog (Arafah, the
   * white days…). Opt-in, off by default. (The weekly strategy reminder and its prefs were removed in round 5, F-12 a;
   * older stored `strategies` / `strategyReminders` / `strategyTime` values are ignored when read.)
   */
  occasionReminders: boolean;
  occasionTime: LocalTime;
  /** «تذكيراتي» (phase 6): the user's own short lines, on this device only (≤ 120 characters, at most 20). */
  myReminders: MyReminder[];
  /** «أوقات الصلاة»: the city whose prayer times anchor «بعد الفجر»… slots; null = default times. */
  prayer: PrayerSettings | null;
  /** 30 days of AlAdhan times for `prayer` (fetched on foreground when it runs low). */
  prayerCache: PrayerCache | null;
  /** «نص اليوم» of the home-screen widget: where its daily text comes from. */
  todayText: TodayTextSource;
}

export const DEFAULT_PREFS: PracticePrefs = {
  v: 1,
  habitReminders: true,
  kinshipReminders: false,
  kinshipShowNames: false,
  kinshipTime: '18:00',
  sinReminders: false,
  sinReminderTime: '21:00',
  eveningNudge: false,
  eveningTime: '21:00',
  fridayReminder: true,
  fridayTime: '17:00',
  roles: [],
  rememberVaultKey: false,
  sinLock: false,
  weekBranch: false,
  showHijri: false,
  occasionReminders: DEFAULT_NOTIFICATION_PREFS.occasions,
  occasionTime: DEFAULT_NOTIFICATION_PREFS.occasionTime,
  myReminders: [],
  prayer: null,
  prayerCache: null,
  todayText: DEFAULT_TODAY_TEXT_SOURCE,
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
      return { ...DEFAULT_PREFS, myReminders: [] };
    }
  }
  if (!isRecord(raw) || raw.v !== 1) return { ...DEFAULT_PREFS, myReminders: [] };
  const bool = (k: keyof PracticePrefs) => (typeof raw[k] === 'boolean' ? (raw[k] as boolean) : (DEFAULT_PREFS[k] as boolean));
  const time = (k: 'kinshipTime' | 'sinReminderTime' | 'eveningTime' | 'fridayTime' | 'occasionTime') => (isValidTime(raw[k]) ? (raw[k] as string) : DEFAULT_PREFS[k]);
  return {
    v: 1,
    habitReminders: bool('habitReminders'),
    kinshipReminders: bool('kinshipReminders'),
    kinshipShowNames: bool('kinshipShowNames'),
    kinshipTime: time('kinshipTime'),
    sinReminders: bool('sinReminders'),
    sinReminderTime: time('sinReminderTime'),
    eveningNudge: bool('eveningNudge'),
    eveningTime: time('eveningTime'),
    fridayReminder: bool('fridayReminder'),
    fridayTime: time('fridayTime'),
    rememberVaultKey: bool('rememberVaultKey'),
    sinLock: bool('sinLock'),
    weekBranch: bool('weekBranch'),
    showHijri: bool('showHijri'),
    occasionReminders: bool('occasionReminders'),
    occasionTime: time('occasionTime'),
    myReminders: parseMyReminders(raw.myReminders),
    prayer: parsePrayerSettings(raw.prayer),
    prayerCache: parsePrayerCache(raw.prayerCache),
    todayText: parseTodayTextSource(raw.todayText),
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
