import { createHash } from 'node:crypto';
import {
  DEFAULT_NOTIFICATION_PREFS,
  diffDays,
  formatPlanAmount,
  notificationPlan,
  NOTIFY_TEXTS,
  requiredOn,
  type NotificationPrefs,
  type Plan,
  type PlanUnit,
  type Store,
} from '@thekra/practice-core';
import type { Habit } from '../practice/practice-catalog.js';
import { zonedParts, zonedToUtc } from './zoned-time.js';

/**
 * Pure web-push planner: a user's synced practice data → the reminders one browser should receive in the next
 * {@link PUSH_WINDOW_HOURS}. The policy is practice-core `notificationPlan` (redesign §4.4), the same one the app's local
 * notifications and the extension's alarms use:
 *
 * - Habits at their slots (`reminderSlots`: none while paused, one once «راسخة»; a periodic plan once per due day); the
 *   body is the amount asked that day (`requiredOn`). Today's slots drop once the day is logged (a sync re-plans).
 * - People lists (صلة الرحم…): one generic reminder per due day, a count and never a name (the text passes through the
 *   scheduler, docs/plan/2026-10-web-push.md §4).
 * - Evening nudge (opt-in) and the Friday review reminder (on by default), with the browser's own switches
 *   (`PushSubscription.prefs`, sent by the web app with the subscription).
 * - Quiet hours 23:00–05:00 (the night prayer and the user's own times excepted), at most 4 a day and then one digest.
 * - The sin program is never here: the server cannot read it.
 */

/** Long enough to outlast one missed daily refill (Vercel Hobby cron fires once a day, ±59 min). */
export const PUSH_WINDOW_HOURS = 48;
/** Per browser and window; keeps one account well inside the scheduler's free daily quota. */
export const MAX_PUSH_PER_WINDOW = 40;

export type PushLocale = 'ar' | 'en';

export interface PlannedPush {
  /**
   * `habit:<planId>:<date>:<time>`, `kinship:<date>`, `evening:<date>`, `friday:<date>` or `digest:<date>`: what the
   * reminder is for, stable across re-plans.
   */
  key: string;
  fireAt: Date;
  title: string;
  body: string;
  /** Site path opened when the notification is clicked. */
  url: string;
  /** Notification tag: a newer reminder for the same thing replaces the older one on screen. */
  tag: string;
  /** Changes when anything the user would see changes. */
  digest: string;
}

const TEXTS = {
  ar: {
    habitBody: (amount: string) => `المطلوب اليوم: ${amount}`,
    kinshipTitle: 'صلة الرحم',
    kinshipBody: (n: number) => `حان وقت التواصل مع ${n} من أقاربك`,
    peopleTitle: 'أعمال دورية',
    peopleBody: (n: number) => `حان وقت التواصل مع ${n} من قوائمك`,
    units: { minutes: 'دقيقة', count: 'مرة', times: 'مرة' } as Record<PlanUnit, string>,
  },
  en: {
    habitBody: (amount: string) => `Today: ${amount}`,
    kinshipTitle: 'Ties of kinship',
    kinshipBody: (n: number) => `Time to get in touch with ${n} of your relatives`,
    peopleTitle: 'Periodic acts',
    peopleBody: (n: number) => `Time to get in touch with ${n} people from your lists`,
    units: { minutes: 'minutes', count: 'times', times: 'times' } as Record<PlanUnit, string>,
  },
} as const;

export interface PushPlanInput {
  store: Store;
  habits: readonly Habit[];
  timeZone: string;
  locale: PushLocale;
  now: Date;
  /** The browser's switches of «التنبيهات» (default: practice-core defaults). */
  prefs?: NotificationPrefs;
  windowHours?: number;
  limit?: number;
}

function habitFor(plan: Pick<Plan, 'id' | 'habitKey'>, habits: readonly Habit[]): Habit | undefined {
  const key = plan.habitKey ?? plan.id;
  return habits.find((h) => h.key === key);
}

function formatAmount(amount: number, unit: PlanUnit, habit: Habit | undefined, locale: PushLocale): string {
  const label = habit ? (locale === 'ar' ? habit.unitLabelAr : habit.unitLabelEn) : TEXTS[locale].units[unit];
  return formatPlanAmount(amount, unit, label, locale, habit?.rakah);
}

function digestOf(item: Omit<PlannedPush, 'digest'>): string {
  const content = JSON.stringify([item.fireAt.toISOString(), item.title, item.body, item.url, item.tag]);
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * A site path in the user's language. The site serves Arabic without a prefix and English under /en
 * (next-intl `localePrefix: 'as-needed'`): `/ar/…` would only redirect, and the service worker would not find the
 * open tab on the same page.
 */
export function sitePath(locale: 'ar' | 'en', path: string): string {
  return locale === 'en' ? `/en${path}` : path;
}

export function planPushes(input: PushPlanInput): PlannedPush[] {
  const { store, habits, timeZone, locale, now } = input;
  const end = new Date(now.getTime() + (input.windowHours ?? PUSH_WINDOW_HOURS) * 3_600_000);
  const { date: today, time: nowTime } = zonedParts(now, timeZone);
  const lastDay = zonedParts(end, timeZone).date;
  const days = diffDays(today, lastDay) + 1;
  const texts = TEXTS[locale];
  const policy = NOTIFY_TEXTS[locale];
  const plansById = new Map(store.plans.map((p) => [p.id, p]));
  const entries = notificationPlan({
    store,
    prefs: { ...(input.prefs ?? DEFAULT_NOTIFICATION_PREFS), privateMoment: false },
    today,
    now: nowTime,
    days,
    dayOptions: {
      hijriOffset: store.settings.hijriOffset,
      defaultRuleOf: (plan) => habitFor(plan, habits)?.defaultRule,
    },
    defaultSlotsOf: (plan) => habitFor(plan, habits)?.defaultSlots,
    kinds: ['habit', 'periodic', 'evening', 'friday', 'digest'],
  });

  const out: Omit<PlannedPush, 'digest'>[] = [];
  for (const entry of entries) {
    const fireAt = zonedToUtc(entry.date, entry.time, timeZone);
    if (fireAt <= now || fireAt > end) continue;
    const practice = sitePath(locale, '/practice');
    if (entry.kind === 'habit') {
      const plan = plansById.get(entry.planId ?? '');
      if (!plan) continue;
      const habit = habitFor(plan, habits);
      const title = habit ? (locale === 'ar' ? habit.titleAr : habit.titleEn) : plan.title;
      const body = texts.habitBody(formatAmount(requiredOn(plan, entry.date), plan.unit, habit, locale));
      out.push({ key: entry.key, fireAt, title, body, url: practice, tag: `habit-${plan.id}` });
    } else if (entry.kind === 'periodic') {
      const ids = new Set(entry.relativeIds ?? []);
      const kin = store.relatives.filter((r) => ids.has(r.id)).every((r) => (r.circle ?? 'kin') === 'kin');
      const count = entry.count ?? ids.size;
      out.push({
        key: `kinship:${entry.date}`,
        fireAt,
        title: kin ? texts.kinshipTitle : texts.peopleTitle,
        body: kin ? texts.kinshipBody(count) : texts.peopleBody(count),
        url: sitePath(locale, '/practice/kinship'),
        tag: 'kinship',
      });
    } else if (entry.kind === 'evening') {
      out.push({ key: entry.key, fireAt, title: policy.wirdTitle, body: policy.eveningBody, url: practice, tag: 'evening' });
    } else if (entry.kind === 'friday') {
      out.push({ key: entry.key, fireAt, title: policy.fridayTitle, body: policy.fridayBody, url: practice, tag: 'friday' });
    } else if (entry.kind === 'digest') {
      out.push({ key: entry.key, fireAt, title: policy.wirdTitle, body: policy.digestBody(entry.count ?? 1), url: practice, tag: 'digest' });
    }
  }

  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || (a.key < b.key ? -1 : 1));
  return out.slice(0, input.limit ?? MAX_PUSH_PER_WINDOW).map((item) => ({ ...item, digest: digestOf(item) }));
}
