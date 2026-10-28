/**
 * Pure reminder planner: practice-core Store + prefs → the local notifications to schedule.
 * No React Native imports, so it runs in Jest; notifications.ts turns the list into expo-notifications calls.
 *
 * - Habits: every day the plan's rule fires (practice-core `occurrences`) in the next {@link REMINDER_DAYS}
 *   days, once per slot. Title = habit title; body = the amount asked for that day (`requiredOn`: ebb and
 *   season aware, never doubled). Today's slots are skipped once they have passed or the day is done.
 * - Kinship: on each relative's next due date (overdue → the next slot from now), then weekly while it stays
 *   due. The title is always generic; names appear in the body only when the user turned that on.
 * - Sin program: one daily reminder whose title is ALWAYS {@link SIN_REMINDER_TITLE} and whose body is a
 *   fixed generic text. Neither the sin nor anything the user wrote ever reaches a notification
 *   (roadmap §0.2), and the notification id carries no slug.
 * - iOS keeps a limited number of pending local notifications (commonly 64), so the list is cut to the
 *   soonest {@link MAX_PENDING}; the app re-plans on every change and every foreground.
 */

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
import { pick, type CatalogHabit, type UiLocale } from './catalog-types';
import { sortSlots } from './format';
import type { PracticePrefs } from './prefs';

/** The only title a sin-program reminder may carry, in every language (roadmap §0.2). */
export const SIN_REMINDER_TITLE = 'تذكرة من ذكرى';
/** `data.source` of every notification this feature schedules (used to cancel only ours). */
export const REMINDER_SOURCE = 'thekra-practice';
export const REMINDER_DAYS = 14;
export const MAX_PENDING = 60;
const KINSHIP_REPEAT_DAYS = 7;

export type ReminderKind = 'habit' | 'kinship' | 'sin';

export interface PlannedReminder {
  id: string;
  kind: ReminderKind;
  date: LocalDate;
  time: LocalTime;
  title: string;
  body: string;
  /** expo-router path opened when the notification is tapped. */
  route: string;
}

export interface ReminderTexts {
  /** e.g. «المطلوب اليوم: 2 دقيقة» from the formatted amount. */
  habitBody: (amountLabel: string) => string;
  kinshipTitle: string;
  kinshipBodyGeneric: (count: number) => string;
  kinshipBodyNames: (names: string) => string;
  /** Generic text; it is never given the sin or the user's notes. */
  sinBody: string;
  /** Unit words used when the catalog is not available. */
  unitFallback: Record<PlanUnit, string>;
  /** Separator between names («، » / «, »). */
  listSeparator: string;
}

export interface ReminderInput {
  store: Store;
  prefs: PracticePrefs;
  habits: readonly CatalogHabit[];
  today: LocalDate;
  /** Current local time; today's slots at or before it are skipped. */
  now: LocalTime;
  locale: UiLocale;
  texts: ReminderTexts;
  days?: number;
  limit?: number;
}

/** The catalog habit of a plan (`habitKey`; plans from tests or old data may carry the key as their id). */
export function habitFor(plan: Pick<Plan, 'id' | 'habitKey'>, habits: readonly CatalogHabit[]): CatalogHabit | undefined {
  const key = plan.habitKey ?? plan.id;
  return habits.find((h) => h.key === key);
}

/** The reminder rule of a plan: its own `rule` (synced), else the catalog default, else daily. */
export function planRule(plan: Pick<Plan, 'id' | 'habitKey' | 'rule'>, habits: readonly CatalogHabit[]): Rule {
  return plan.rule ?? habitFor(plan, habits)?.defaultRule ?? { kind: 'daily' };
}

/** «2 دقيقة», «ركعتان», «3 × ركعتان», "33 times". Western digits. */
export function formatAmount(
  amount: number,
  unit: PlanUnit,
  habit: CatalogHabit | undefined,
  locale: UiLocale,
  unitFallback: Record<PlanUnit, string>,
): string {
  const label = habit ? pick(habit, 'unitLabel', locale) : unitFallback[unit];
  if (unit === 'times') return amount === 1 ? label : `${amount} × ${label}`;
  return `${amount} ${label}`;
}

function habitReminders(input: ReminderInput, end: LocalDate): PlannedReminder[] {
  const { store, habits, today, now, locale, texts } = input;
  const out: PlannedReminder[] = [];
  for (const plan of store.plans) {
    let dates: LocalDate[];
    try {
      dates = occurrences(planRule(plan, habits), today, end, { hijriOffset: store.settings.hijriOffset });
    } catch {
      continue; // e.g. a Hijri rule on a runtime without Umm al-Qura: no reminder rather than a wrong one
    }
    const habit = habitFor(plan, habits);
    const title = habit ? pick(habit, 'title', locale) : plan.title;
    for (const date of dates) {
      const required = requiredOn(plan, date);
      if (date === today && (plan.log[today] ?? 0) >= required) continue;
      const body = texts.habitBody(formatAmount(required, plan.unit, habit, locale, texts.unitFallback));
      for (const time of sortSlots(plan.slots)) {
        if (date === today && time <= now) continue;
        out.push({
          id: `${REMINDER_SOURCE}:habit:${plan.id}:${date}:${time}`,
          kind: 'habit',
          date,
          time,
          title,
          body,
          route: `/practice/plan/${plan.id}`,
        });
      }
    }
  }
  return out;
}

function kinshipReminders(input: ReminderInput, end: LocalDate): PlannedReminder[] {
  const { store, prefs, today, now, texts } = input;
  if (!prefs.kinshipReminders || store.relatives.length === 0) return [];
  const time = prefs.kinshipTime;
  const firstSlot = time > now ? today : addDays(today, 1);
  const byDate = new Map<LocalDate, string[]>();
  for (const rel of store.relatives) {
    const due = nextDue(rel, today);
    for (let date = due < firstSlot ? firstSlot : due; date <= end; date = addDays(date, KINSHIP_REPEAT_DAYS)) {
      const names = byDate.get(date) ?? [];
      names.push(rel.name);
      byDate.set(date, names);
    }
  }
  return [...byDate.entries()].map(([date, names]) => ({
    id: `${REMINDER_SOURCE}:kinship:${date}`,
    kind: 'kinship' as const,
    date,
    time,
    title: texts.kinshipTitle,
    body: prefs.kinshipShowNames ? texts.kinshipBodyNames(names.join(texts.listSeparator)) : texts.kinshipBodyGeneric(names.length),
    route: '/practice/kinship',
  }));
}

function sinReminders(input: ReminderInput, days: number): PlannedReminder[] {
  const { store, prefs, today, now, texts } = input;
  if (!prefs.sinReminders || store.programs.length === 0) return [];
  const time = prefs.sinReminderTime;
  const checkedInToday = store.programs.some((p) => p.checkIns.some((c) => c.date === today));
  const out: PlannedReminder[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    if (date === today && (time <= now || checkedInToday)) continue;
    out.push({
      id: `${REMINDER_SOURCE}:private:${date}`,
      kind: 'sin',
      date,
      time,
      title: SIN_REMINDER_TITLE,
      body: texts.sinBody,
      route: '/practice/sin-program',
    });
  }
  return out;
}

/** Everything to schedule, soonest first, at most `limit` entries. */
export function planReminders(input: ReminderInput): PlannedReminder[] {
  const days = input.days ?? REMINDER_DAYS;
  const limit = input.limit ?? MAX_PENDING;
  if (days <= 0) return [];
  const end = addDays(input.today, days - 1);
  const all = [
    ...(input.prefs.habitReminders ? habitReminders(input, end) : []),
    ...kinshipReminders(input, end),
    ...sinReminders(input, days),
  ];
  all.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : a.id < b.id ? -1 : 1));
  return all.slice(0, limit);
}
