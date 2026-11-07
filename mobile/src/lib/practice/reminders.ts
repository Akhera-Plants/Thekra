/**
 * Pure reminder planner: practice-core Store + prefs → the local notifications to schedule. The policy is practice-core
 * `notificationPlan` (redesign §4.4), shared with the web push planner and the extension: habits at their slots (the
 * second only while the day is not done; one slot once «راسخة»; a periodic plan once per due day), people lists once per
 * due day, the evening nudge (opt-in), the Friday review reminder (on by default), the private moment, quiet hours
 * 23:00–05:00 (the night prayer and the user's own times excepted) and at most 4 a day, then one digest.
 * No React Native imports, so it runs in Jest; notifications.ts turns the list into expo-notifications calls.
 *
 * - The sin program reminder's title is ALWAYS {@link SIN_REMINDER_TITLE} and its body a fixed generic text. Neither
 *   the sin nor anything the user wrote ever reaches a notification (roadmap §0.2), and the id carries no slug.
 * - People lists: the title is always generic; names appear in the body only when the user turned that on.
 * - iOS keeps a limited number of pending local notifications (commonly 64), so the list is cut to the
 *   soonest {@link MAX_PENDING}; the app re-plans on every change and every foreground.
 */

import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_REVIEW_DAY,
  isPlanDueOn,
  formatPlanAmount,
  notificationPlan,
  prayerLookup,
  NOTIFY_TEXTS,
  requiredOn,
  type LocalDate,
  type LocalTime,
  type NotificationPrefs,
  type Plan,
  type PlanUnit,
  type Rule,
  type Store,
} from '@thekra/practice-core';
import { pick, type CatalogHabit, type UiLocale } from './catalog-types';
import type { PracticePrefs } from './prefs';

/** The only title a sin-program reminder may carry, in every language (roadmap §0.2). */
export const SIN_REMINDER_TITLE = 'تذكرة من ذكرى';
/** `data.source` of every notification this feature schedules (used to cancel only ours). */
export const REMINDER_SOURCE = 'thekra-practice';
export const REMINDER_DAYS = 14;
export const MAX_PENDING = 60;

export type ReminderKind = 'habit' | 'kinship' | 'sin' | 'evening' | 'friday' | 'strategy' | 'digest';

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
  /** The policy's own words (practice-core `NOTIFY_TEXTS`, mirrored in the app's i18n). */
  wirdTitle: string;
  eveningBody: string;
  fridayTitle: string;
  fridayBody: string;
  digestBody: (count: number) => string;
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
  /** The weekly review's day, 0 = Sunday … 6 = Saturday: practice-core `HeartPrefs.reviewDay` (stored there only). */
  reviewDay?: number;
  /** True when that review day's review is saved, or the weekly review is off (no reminder). */
  reviewDoneOn?: (day: LocalDate) => boolean;
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

/**
 * True when the habit is asked for on `date`: the plan's rule, else the catalog default, else daily (practice-core
 * `isPlanDueOn`; a rule this runtime cannot evaluate counts as due). The today list and the reminders both use it.
 */
export function planDueOn(
  plan: Plan,
  habits: readonly CatalogHabit[],
  date: LocalDate,
  hijriOffset: number,
): boolean {
  return isPlanDueOn(plan, date, habitFor(plan, habits)?.defaultRule, { hijriOffset });
}

/** «2 دقيقة», «صدقة», «3 × صدقة», «4 ركعات», "33 times". Western digits. */
export function formatAmount(
  amount: number,
  unit: PlanUnit,
  habit: CatalogHabit | undefined,
  locale: UiLocale,
  unitFallback: Record<PlanUnit, string>,
): string {
  const label = habit ? pick(habit, 'unitLabel', locale) : unitFallback[unit];
  return formatPlanAmount(amount, unit, label, locale, habit?.rakah);
}

/**
 * The policy's switches from the app prefs (practice-core `NotificationPrefs`); the weekly review's day is the heart's
 * (`HeartPrefs.reviewDay`, the one place it is kept).
 */
export function notificationPrefsOf(prefs: PracticePrefs, reviewDay: number = DEFAULT_REVIEW_DAY): NotificationPrefs {
  return {
    habits: prefs.habitReminders,
    periodic: prefs.kinshipReminders,
    periodicTime: prefs.kinshipTime,
    eveningNudge: prefs.eveningNudge,
    eveningTime: prefs.eveningTime,
    fridayReview: prefs.fridayReminder,
    fridayTime: prefs.fridayTime,
    reviewDay,
    privateMoment: prefs.sinReminders,
    privateTime: prefs.sinReminderTime,
    // «مناسبة قريبة» (round 5): off until the app has its switch.
    occasions: DEFAULT_NOTIFICATION_PREFS.occasions,
    occasionTime: DEFAULT_NOTIFICATION_PREFS.occasionTime,
    strategies: prefs.strategyReminders ? prefs.strategies : [],
    strategyTime: prefs.strategyTime,
  };
}

/** Everything to schedule under practice-core `notificationPlan`, soonest first, at most `limit` entries. */
export function planReminders(input: ReminderInput): PlannedReminder[] {
  const { store, habits, today, now, locale, texts, prefs } = input;
  const days = input.days ?? REMINDER_DAYS;
  const limit = input.limit ?? MAX_PENDING;
  if (days <= 0) return [];
  const entries = notificationPlan({
    store,
    prefs: notificationPrefsOf(prefs, input.reviewDay),
    today,
    now,
    days,
    dayOptions: { hijriOffset: store.settings.hijriOffset, defaultRuleOf: (plan) => habitFor(plan, habits)?.defaultRule },
    defaultSlotsOf: (plan) => habitFor(plan, habits)?.defaultSlots,
    // Prayer anchors («بعد الفجر»…) from the 30-day AlAdhan cache; default times when unset or not cached.
    prayerTimesOn: prayerLookup(prefs.prayerCache, prefs.prayer),
    reviewDoneOn: input.reviewDoneOn,
  });
  const plans = new Map(store.plans.map((p) => [p.id, p]));
  const names = new Map(store.relatives.map((r) => [r.id, r.name]));
  const out: PlannedReminder[] = [];
  for (const e of entries) {
    const base = { date: e.date, time: e.time };
    if (e.kind === 'habit') {
      const plan = plans.get(e.planId ?? '');
      if (!plan) continue;
      const habit = habitFor(plan, habits);
      out.push({
        ...base,
        id: `${REMINDER_SOURCE}:${e.key}`,
        kind: 'habit',
        title: habit ? pick(habit, 'title', locale) : plan.title,
        body: texts.habitBody(formatAmount(requiredOn(plan, e.date), plan.unit, habit, locale, texts.unitFallback)),
        route: `/practice/plan/${plan.id}`,
      });
    } else if (e.kind === 'periodic') {
      const ids = e.relativeIds ?? [];
      out.push({
        ...base,
        id: `${REMINDER_SOURCE}:kinship:${e.date}`,
        kind: 'kinship',
        title: texts.kinshipTitle,
        body: prefs.kinshipShowNames
          ? texts.kinshipBodyNames(ids.map((id) => names.get(id) ?? '').filter(Boolean).join(texts.listSeparator))
          : texts.kinshipBodyGeneric(e.count ?? ids.length),
        route: '/practice/kinship',
      });
    } else if (e.kind === 'private') {
      out.push({ ...base, id: `${REMINDER_SOURCE}:private:${e.date}`, kind: 'sin', title: SIN_REMINDER_TITLE, body: texts.sinBody, route: '/practice/sin-program' });
    } else if (e.kind === 'evening') {
      out.push({ ...base, id: `${REMINDER_SOURCE}:${e.key}`, kind: 'evening', title: texts.wirdTitle, body: texts.eveningBody, route: '/habits' });
    } else if (e.kind === 'friday') {
      out.push({ ...base, id: `${REMINDER_SOURCE}:${e.key}`, kind: 'friday', title: texts.fridayTitle, body: texts.fridayBody, route: '/habits' });
    } else if (e.kind === 'strategy' && e.strategy) {
      // «ذكّرني بها»: the shared words of the policy (practice-core NOTIFY_TEXTS), the strategy's short title.
      const words = NOTIFY_TEXTS[locale];
      out.push({ ...base, id: `${REMINDER_SOURCE}:${e.key}`, kind: 'strategy', title: words.strategyTitle, body: words.strategyBody(e.strategy), route: '/practice/strategies' });
    } else if (e.kind === 'digest') {
      out.push({ ...base, id: `${REMINDER_SOURCE}:${e.key}`, kind: 'digest', title: texts.wirdTitle, body: texts.digestBody(e.count ?? 1), route: '/habits' });
    }
  }
  return out.slice(0, limit);
}
