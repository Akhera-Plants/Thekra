/**
 * Pure reminder scheduling on top of @thekra/practice-core. No chrome.* here, so it runs in Node tests.
 *
 * A reminder fires at each plan slot (`HH:MM`, local time) on each day the plan is due: its own rule (`Plan.rule`),
 * else the catalog habit's default rule, else daily, the same answer as practice-core `isPlanDueOn` that the
 * website, the push planner and the popup's today card use (practice-core `nextOccurrences`, Hijri rules with the
 * user's offset), except on the user's quiet weekdays.
 * A paused plan reminds of nothing and an established («راسخة») one only in its first slot (practice-core
 * `reminderSlots`, the same as the website, the push planner and the app).
 * Today's remaining slots are skipped once today's required amount is logged (`requiredOn`; a missed day is
 * never added to the next one).
 *
 * The policy is practice-core `notificationPlan` (redesign §4.4), the same as the app and the web push planner: a
 * periodic plan once per due day, quiet hours 23:00–05:00 (the night prayer and the user's own times excepted), at most
 * 4 a day and the rest as one digest alarm `digest|<date>|<time>` («عندك n أعمال اليوم»). The extension has habits only.
 */
import {
  DEFAULT_NOTIFICATION_PREFS,
  emptyStore,
  isPaused,
  isPausedOn,
  isPlanDueOn,
  isValidDate,
  isValidTime,
  normalize,
  notificationPlan,
  reminderSlots,
  requiredOn,
  todayFrom,
  weekday,
  type LocalDate,
  type LocalTime,
  type PlannedNotification,
  type Plan,
  type Rule,
} from '@thekra/practice-core';

export interface ScheduleInput {
  plans: readonly Plan[];
  /** Weekdays without reminders (0 = Sunday). */
  quietDays: readonly number[];
  hijriOffset: number;
  now: Date;
  /** Catalog default rules by habit key, for plans without a rule of their own (e.g. made on the website). */
  habitRules?: Readonly<Record<string, Rule>>;
  /** Catalog suggested slots by habit key: a slot among them inside the quiet hours does not ring. */
  habitSlots?: Readonly<Record<string, readonly string[]>>;
}

export interface Reminder {
  planId: string;
  date: LocalDate;
  time: LocalTime;
  /** Epoch milliseconds of `date` + `time` in the device's time zone. */
  when: number;
}

/** Days searched ahead (a yearly Hijri rule fits). */
export const SEARCH_DAYS = 400;

const DAILY: Rule = { kind: 'daily' };

/** Epoch ms for a local calendar day and time (the browser applies its own time zone and DST). */
export function localInstant(date: LocalDate, time: LocalTime): number {
  if (!isValidDate(date) || !isValidTime(time)) throw new RangeError('Invalid date or time');
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

/** The plan's schedule: its own rule, else `fallback` (the catalog habit's default rule), else daily. */
export function ruleOf(plan: Pick<Plan, 'rule'>, fallback?: Rule): Rule {
  return plan.rule ?? fallback ?? DAILY;
}

/** The catalog default rule of the plan's habit, from `habitRules` keyed by habit key. */
export function fallbackRule(plan: Pick<Plan, 'habitKey'>, habitRules: Readonly<Record<string, Rule>> = {}): Rule | undefined {
  return plan.habitKey === undefined ? undefined : habitRules[plan.habitKey];
}

/** What is still asked for on `date` (0 when the required amount is already logged). */
export function remainingOn(plan: Plan, date: LocalDate): number {
  return Math.max(0, requiredOn(plan, date) - (plan.log[date] ?? 0));
}

function localTime(now: Date): LocalTime {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** The policy's habit and digest entries ahead of `now`, without the user's quiet weekdays. */
export function plannedEntries(input: ScheduleInput, days = SEARCH_DAYS): PlannedNotification[] {
  const today = todayFrom(input.now);
  const base = emptyStore();
  const store = { ...base, plans: input.plans.map((p) => normalize(p, today)), settings: { ...base.settings, hijriOffset: input.hijriOffset } };
  const quiet = new Set(input.quietDays);
  return notificationPlan({
    store,
    prefs: { ...DEFAULT_NOTIFICATION_PREFS, periodic: false, eveningNudge: false, fridayReview: false, privateMoment: false },
    today,
    now: localTime(input.now),
    days,
    dayOptions: { hijriOffset: input.hijriOffset, defaultRuleOf: (plan) => fallbackRule(plan, input.habitRules) },
    defaultSlotsOf: (plan) => (plan.habitKey === undefined ? undefined : input.habitSlots?.[plan.habitKey]),
    kinds: ['habit', 'digest'],
  }).filter((e) => !quiet.has(weekday(e.date)) && localInstant(e.date, e.time) > input.now.getTime());
}

/**
 * The next reminders, at most `perPlan` for each plan, sorted by time. Only instants strictly after `now`.
 */
export function upcomingReminders(input: ScheduleInput, perPlan = 1): Reminder[] {
  const count = new Map<string, number>();
  const out: Reminder[] = [];
  for (const e of plannedEntries(input)) {
    if (e.kind !== 'habit' || !e.planId) continue;
    const n = count.get(e.planId) ?? 0;
    if (n >= perPlan) continue;
    count.set(e.planId, n + 1);
    out.push({ planId: e.planId, date: e.date, time: e.time, when: localInstant(e.date, e.time) });
  }
  return out.sort((a, b) => a.when - b.when || a.planId.localeCompare(b.planId));
}

export interface Digest {
  date: LocalDate;
  time: LocalTime;
  count: number;
  when: number;
}

/** The next digest alarms (more than four reminders on a day become one), soonest first. */
export function upcomingDigests(input: ScheduleInput, limit = 2): Digest[] {
  return plannedEntries(input, 14)
    .filter((e) => e.kind === 'digest')
    .slice(0, limit)
    .map((e) => ({ date: e.date, time: e.time, count: e.count ?? 1, when: localInstant(e.date, e.time) }));
}

/** How many plans still ask for something today (the digest's «n»). */
export function openPlansToday(plans: readonly Plan[], now: Date, hijriOffset: number, habitRules: Readonly<Record<string, Rule>> = {}): number {
  const today = todayFrom(now);
  return plans.filter((raw) => {
    const plan = normalize(raw, today);
    if (isPausedOn(plan, today) || today < plan.createdOn) return false;
    return isPlanDueOn(plan, today, fallbackRule(plan, habitRules), { hijriOffset }) && remainingOn(plan, today) > 0;
  }).length;
}

/**
 * True when `date` is a reminder day for the plan: practice-core `isPlanDueOn` (its rule, else `fallback`, the
 * catalog habit's default rule, else daily) and the weekday is not one of the user's quiet days.
 */
export function isReminderDay(
  plan: Plan,
  fallback: Rule | undefined,
  quietDays: readonly number[],
  date: LocalDate,
  hijriOffset: number,
): boolean {
  if (quietDays.includes(weekday(date)) || isPausedOn(plan, date)) return false;
  return isPlanDueOn(plan, date, fallback, { hijriOffset });
}

// ---- Alarm names -------------------------------------------------------------------------------------

const REMIND = 'remind';
const SNOOZE = 'snooze';
const DIGEST = 'digest';
/** Plan ids are habit keys (slugs), so `|` never appears inside a field. */
const SEP = '|';

export function reminderAlarmName(r: Pick<Reminder, 'planId' | 'date' | 'time'>): string {
  return [REMIND, r.planId, r.date, r.time].join(SEP);
}

export function snoozeAlarmName(planId: string, date: LocalDate): string {
  return [SNOOZE, planId, date].join(SEP);
}

export function digestAlarmName(d: Pick<Digest, 'date' | 'time'>): string {
  return [DIGEST, d.date, d.time].join(SEP);
}

export type ParsedAlarm =
  | { kind: 'remind'; planId: string; date: LocalDate; time: LocalTime }
  | { kind: 'snooze'; planId: string; date: LocalDate }
  | { kind: 'digest'; date: LocalDate; time: LocalTime };

export function parseAlarmName(name: string): ParsedAlarm | null {
  const parts = name.split(SEP);
  if (parts[0] === REMIND && parts.length === 4) {
    const [, planId, date, time] = parts as [string, string, string, string];
    if (planId && isValidDate(date) && isValidTime(time)) return { kind: 'remind', planId, date, time };
  }
  if (parts[0] === DIGEST && parts.length === 3) {
    const [, date, time] = parts as [string, string, string];
    if (isValidDate(date) && isValidTime(time)) return { kind: 'digest', date, time };
  }
  if (parts[0] === SNOOZE && parts.length === 3) {
    const [, planId, date] = parts as [string, string, string];
    if (planId && isValidDate(date)) return { kind: 'snooze', planId, date };
  }
  return null;
}

export const SNOOZE_MINUTES = 30;

/** When a «لاحقًا» snooze fires. */
export function snoozeUntil(now: Date): number {
  return now.getTime() + SNOOZE_MINUTES * 60_000;
}

/**
 * Whether an alarm that fired at `now` for `date` should still show a notification: only on the same local
 * day (a browser that was closed fires missed alarms on start; yesterday's reminder is not shown), only for an
 * existing plan, and only while something is still asked for today.
 */
export function shouldNotify(plan: Plan | undefined, date: LocalDate, now: Date): boolean {
  if (!plan || isPaused(plan)) return false;
  const today = todayFrom(now);
  if (date !== today) return false;
  return remainingOn(normalize(plan, today), today) > 0;
}
