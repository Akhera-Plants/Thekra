import { createHash } from 'node:crypto';
import {
  addDays,
  nextDue,
  occurrences,
  requiredOn,
  type LocalDate,
  type LocalTime,
  type Plan,
  type PlanUnit,
  type Rule,
  type Store,
} from '@thekra/practice-core';
import type { Habit } from '../practice/practice-catalog.js';
import { zonedParts, zonedToUtc } from './zoned-time.js';

/**
 * Pure web-push planner: a user's synced practice data → the reminders one browser should receive in the next
 * {@link PUSH_WINDOW_HOURS}. It follows the mobile planner (mobile/src/lib/practice/reminders.ts) so a habit
 * reminds at the same times on the phone and in the browser:
 *
 * - Habits: every day the plan's rule fires, once per slot; the body is the amount asked for that day
 *   (`requiredOn`). Today's slots are left out once the day is done, so logging cancels the rest of the day.
 * - Kinship: one generic reminder on each day relatives are due (no names: the text passes through the
 *   scheduler, docs/plan/2026-10-web-push.md §4).
 * - The sin program is never here: the server cannot read it.
 */

/** Long enough to outlast one missed daily refill (Vercel Hobby cron fires once a day, ±59 min). */
export const PUSH_WINDOW_HOURS = 48;
/** Per browser and window; keeps one account well inside the scheduler's free daily quota. */
export const MAX_PUSH_PER_WINDOW = 40;
export const KINSHIP_PUSH_TIME: LocalTime = '18:00';
const KINSHIP_REPEAT_DAYS = 7;

export type PushLocale = 'ar' | 'en';

export interface PlannedPush {
  /** `habit:<planId>:<date>:<time>` or `kinship:<date>`: what the reminder is for, stable across re-plans. */
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
    units: { minutes: 'دقيقة', count: 'مرة', times: 'مرة' } as Record<PlanUnit, string>,
  },
  en: {
    habitBody: (amount: string) => `Today: ${amount}`,
    kinshipTitle: 'Ties of kinship',
    kinshipBody: (n: number) => `Time to get in touch with ${n} of your relatives`,
    units: { minutes: 'minutes', count: 'times', times: 'times' } as Record<PlanUnit, string>,
  },
} as const;

export interface PushPlanInput {
  store: Store;
  habits: readonly Habit[];
  timeZone: string;
  locale: PushLocale;
  now: Date;
  windowHours?: number;
  limit?: number;
}

function habitFor(plan: Pick<Plan, 'id' | 'habitKey'>, habits: readonly Habit[]): Habit | undefined {
  const key = plan.habitKey ?? plan.id;
  return habits.find((h) => h.key === key);
}

function formatAmount(amount: number, unit: PlanUnit, habit: Habit | undefined, locale: PushLocale): string {
  const label = habit ? (locale === 'ar' ? habit.unitLabelAr : habit.unitLabelEn) : TEXTS[locale].units[unit];
  if (unit === 'times') return amount === 1 ? label : `${amount} × ${label}`;
  return `${amount} ${label}`;
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
  const today = zonedParts(now, timeZone).date;
  const lastDay = zonedParts(end, timeZone).date;
  const texts = TEXTS[locale];
  const inWindow = (at: Date) => at > now && at <= end;
  const out: Omit<PlannedPush, 'digest'>[] = [];

  for (const plan of store.plans) {
    const habit = habitFor(plan, habits);
    const rule: Rule = plan.rule ?? habit?.defaultRule ?? { kind: 'daily' };
    let dates: LocalDate[];
    try {
      dates = occurrences(rule, today, lastDay, { hijriOffset: store.settings.hijriOffset });
    } catch {
      continue; // a rule the runtime cannot evaluate: no reminder rather than a wrong one
    }
    const title = habit ? (locale === 'ar' ? habit.titleAr : habit.titleEn) : plan.title;
    for (const date of dates) {
      const required = requiredOn(plan, date);
      if (date === today && (plan.log[today] ?? 0) >= required) continue;
      const body = texts.habitBody(formatAmount(required, plan.unit, habit, locale));
      for (const time of [...new Set(plan.slots)].sort()) {
        const fireAt = zonedToUtc(date, time, timeZone);
        if (!inWindow(fireAt)) continue;
        out.push({ key: `habit:${plan.id}:${date}:${time}`, fireAt, title, body, url: sitePath(locale, '/practice'), tag: `habit-${plan.id}` });
      }
    }
  }

  // As on mobile: an overdue relative reminds at the next kinship time from now, then weekly while still due.
  const firstSlot = zonedToUtc(today, KINSHIP_PUSH_TIME, timeZone) > now ? today : addDays(today, 1);
  const dueCount = new Map<LocalDate, number>();
  for (const rel of store.relatives) {
    const due = nextDue(rel, today);
    for (let date = due < firstSlot ? firstSlot : due; date <= lastDay; date = addDays(date, KINSHIP_REPEAT_DAYS)) {
      dueCount.set(date, (dueCount.get(date) ?? 0) + 1);
    }
  }
  for (const [date, count] of dueCount) {
    const fireAt = zonedToUtc(date, KINSHIP_PUSH_TIME, timeZone);
    if (!inWindow(fireAt)) continue;
    out.push({
      key: `kinship:${date}`,
      fireAt,
      title: texts.kinshipTitle,
      body: texts.kinshipBody(count),
      url: sitePath(locale, '/practice/kinship'),
      tag: 'kinship',
    });
  }

  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || (a.key < b.key ? -1 : 1));
  return out.slice(0, input.limit ?? MAX_PUSH_PER_WINDOW).map((item) => ({ ...item, digest: digestOf(item) }));
}
