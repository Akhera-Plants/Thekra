/**
 * Pure reminder scheduling on top of @thekra/practice-core. No chrome.* here, so it runs in Node tests.
 *
 * A reminder fires at each plan slot (`HH:MM`, local time) on each day the plan's rule (`Plan.rule`, daily when
 * absent) fires
 * (practice-core `nextOccurrences`, Hijri rules with the user's offset), except on the user's quiet weekdays.
 * Today's remaining slots are skipped once today's required amount is logged (`requiredOn`; a missed day is
 * never added to the next one).
 */
import {
  isValidDate,
  isValidTime,
  nextOccurrences,
  normalize,
  requiredOn,
  todayFrom,
  weekday,
  type LocalDate,
  type LocalTime,
  type Plan,
  type Rule,
} from '@thekra/practice-core';

export interface ScheduleInput {
  plans: readonly Plan[];
  /** Weekdays without reminders (0 = Sunday). */
  quietDays: readonly number[];
  hijriOffset: number;
  now: Date;
}

export interface Reminder {
  planId: string;
  date: LocalDate;
  time: LocalTime;
  /** Epoch milliseconds of `date` + `time` in the device's time zone. */
  when: number;
}

/** Rule days searched ahead per plan (a weekly rule looks 14 weeks ahead). */
export const SEARCH_OCCURRENCES = 14;

const DAILY: Rule = { kind: 'daily' };

/** Epoch ms for a local calendar day and time (the browser applies its own time zone and DST). */
export function localInstant(date: LocalDate, time: LocalTime): number {
  if (!isValidDate(date) || !isValidTime(time)) throw new RangeError('Invalid date or time');
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

/** The plan's schedule; a plan without a rule (e.g. made on another device) is daily. */
export function ruleOf(plan: Pick<Plan, 'rule'>): Rule {
  return plan.rule ?? DAILY;
}

/** What is still asked for on `date` (0 when the required amount is already logged). */
export function remainingOn(plan: Plan, date: LocalDate): number {
  return Math.max(0, requiredOn(plan, date) - (plan.log[date] ?? 0));
}

/**
 * The next reminders, at most `perPlan` for each plan, sorted by time. Only instants strictly after `now`.
 */
export function upcomingReminders(input: ScheduleInput, perPlan = 1): Reminder[] {
  const nowMs = input.now.getTime();
  const today = todayFrom(input.now);
  const quiet = new Set(input.quietDays);
  const out: Reminder[] = [];
  for (const raw of input.plans) {
    const plan = normalize(raw, today);
    const slots = [...new Set(plan.slots)].sort();
    const found: Reminder[] = [];
    const days = nextOccurrences(ruleOf(plan), today, SEARCH_OCCURRENCES, { hijriOffset: input.hijriOffset });
    for (const date of days) {
      if (found.length >= perPlan) break;
      if (quiet.has(weekday(date))) continue;
      if (date === today && remainingOn(plan, today) === 0) continue;
      for (const time of slots) {
        const when = localInstant(date, time);
        if (when <= nowMs) continue;
        found.push({ planId: plan.id, date, time, when });
        if (found.length >= perPlan) break;
      }
    }
    out.push(...found);
  }
  return out.sort((a, b) => a.when - b.when || a.planId.localeCompare(b.planId));
}

/** True when `date` is a reminder day for the rule (rule fires and the weekday is not quiet). */
export function isReminderDay(rule: Rule, quietDays: readonly number[], date: LocalDate, hijriOffset: number): boolean {
  if (quietDays.includes(weekday(date))) return false;
  return nextOccurrences(rule, date, 1, { hijriOffset })[0] === date;
}

// ---- Alarm names -------------------------------------------------------------------------------------

const REMIND = 'remind';
const SNOOZE = 'snooze';
/** Plan ids are habit keys (slugs), so `|` never appears inside a field. */
const SEP = '|';

export function reminderAlarmName(r: Pick<Reminder, 'planId' | 'date' | 'time'>): string {
  return [REMIND, r.planId, r.date, r.time].join(SEP);
}

export function snoozeAlarmName(planId: string, date: LocalDate): string {
  return [SNOOZE, planId, date].join(SEP);
}

export type ParsedAlarm = { kind: 'remind'; planId: string; date: LocalDate; time: LocalTime } | { kind: 'snooze'; planId: string; date: LocalDate };

export function parseAlarmName(name: string): ParsedAlarm | null {
  const parts = name.split(SEP);
  if (parts[0] === REMIND && parts.length === 4) {
    const [, planId, date, time] = parts as [string, string, string, string];
    if (planId && isValidDate(date) && isValidTime(time)) return { kind: 'remind', planId, date, time };
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
  if (!plan) return false;
  const today = todayFrom(now);
  if (date !== today) return false;
  return remainingOn(normalize(plan, today), today) > 0;
}
