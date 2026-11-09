/**
 * One notification policy for every client (redesign §4.4): the app's local notifications, the web push planner
 * (backend/src/modules/push) and the browser extension's alarms all call {@link notificationPlan}, then render the
 * entries with their own words (the generic texts below, the habit templates they already have).
 *
 * - A habit reminds at its slots (practice-core `reminderSlots`: none while paused, one once «راسخة»); a periodic plan
 *   (its rule is not daily) once per due day, in its first slot. Today's slots are left out once the day is done, so
 *   the second slot comes only when the first did not lead to a log (the clients re-plan after every change).
 * - Periodic people lists (صلة الرحم…): one generic reminder per due day at the user's time; an overdue person reminds at
 *   the next time from now, then weekly (a sick person every {@link SICK_VISIT_EVERY_DAYS} days) while still due.
 * - Evening nudge (opt-in, off by default): at most once a day, only while a habit asked that day is not done.
 * - Weekly review reminder (on by default): on the user's review day (`reviewDay`, Friday by default) at `fridayTime`,
 *   unless saved.
 * - The private moment reminder (the sin program's generic check-in): unchanged, generic, never a name.
 * - «مناسبة قريبة» (round 5, F-17; opt-in, off by default): the day before a non-weekly occasion of the practice catalog
 *   (Arafah, the ten days, Ashura, the white days…; never Mondays/Thursdays or Friday), at the user's time. The client
 *   passes the catalog's occasions (`GET /v1/practice/catalog`), the server its own copy of the same catalog.
 * - Round 6 (C-19): the weekly strategy reminder is back «as the reference has it»: the chosen strategies
 *   (`strategies`), one a week rotating, on the member's day and time (`strategyDay`, `strategyTime`). Opt-in: nothing
 *   is planned without a chosen strategy.
 * - Round 6: «نية اليوم» reminder (opt-in, `intentionReminder` at `intentionTime`), unless that day's intention is made
 *   (`intentionDoneOn`).
 * - Round 6: per-item switches — `mutedPlans` (a habit or periodic plan by id) and `mutedActs` (a periodic act by its
 *   `periodic.ts` key, e.g. `silat` for every people list) — so «التنبيهات» can list one row per habit and per active act.
 * - The settings page groups the switches in four tabs ({@link NOTIFICATION_GROUPS}): العادات · الأعمال الدورية · النية
 *   والمحاسبة · الاستراتيجيات. There is no calendar (ICS) file in it any more (C-19).
 * - Quiet hours {@link QUIET_START}–{@link QUIET_END}: nothing the policy chose rings inside them. A habit slot inside
 *   them rings only for the night prayer ({@link NIGHT_HABIT_KEYS}) or when the user set that time himself (it is not
 *   one of the catalog's suggested slots). Times the user picks in «التنبيهات» are his own choice.
 * - At most {@link DAILY_CAP} a day: past that, the rest of the day is one digest «عندك n أعمال اليوم». «مناسبة قريبة» is
 *   outside the cap (information, at most one a day, opt-in).
 * - Excused days («عذر») and paused plans remind of nothing. No text here ever names a sin or blames.
 *
 * Pure; the store is never changed. Dates and times are the user's local `YYYY-MM-DD` / `HH:MM`.
 */
import { addDays, isValidTime, timeToMinutes, weekday, type LocalDate, type LocalTime } from './dates.js';
import { planAsksOn, type PlanDayOptions } from './agenda.js';
import { circleOf, isRelativeOpen, nextDue, SICK_VISIT_EVERY_DAYS } from './kinship.js';
import { isPaused, reminderSlots, requiredOn, type Plan } from './plan.js';
import { activePrograms } from './sin-program.js';
import { isExcused, type Store } from './storage.js';
import { isPeriodicPlan } from './wird.js';
import { cleanStrategyKeys, strategyByKey, strategyOfWeek, STRATEGY_WEEKDAY } from './strategies.js';
import { periodicActKeyOf } from './periodic.js';
import type { PrayerTimesLookup } from './prayer.js';
import { occurrences, type Rule } from './rules.js';
import type { AgendaOccasion } from './agenda.js';

/** No reminder chosen by the policy rings from this time… */
export const QUIET_START: LocalTime = '23:00';
/** …until this one. */
export const QUIET_END: LocalTime = '05:00';
/** Catalog habit keys that may ring inside the quiet hours (the night prayer). */
export const NIGHT_HABIT_KEYS: readonly string[] = ['qiyam-last-third'];
/** Notifications per day at most; past it the rest of the day becomes one digest. */
export const DAILY_CAP = 4;
/** A people list reminds again after this many days while someone stays due. */
export const PERIODIC_REPEAT_DAYS = 7;

/** `strategy` is planned again since round 6 (C-19); `intention` is new in round 6. */
export type NotificationKind = 'habit' | 'periodic' | 'evening' | 'friday' | 'private' | 'occasion' | 'strategy' | 'intention' | 'digest';

/** The kinds {@link notificationPlan} plans (when `kinds` is not given). */
export const NOTIFICATION_KINDS: readonly NotificationKind[] = ['habit', 'periodic', 'evening', 'friday', 'private', 'occasion', 'strategy', 'intention', 'digest'];

/** Every switch and time of «التنبيهات». Device-local on each client (the web sends it with its push subscription). */
export interface NotificationPrefs {
  /** Habit reminders at their slots. */
  habits: boolean;
  /** People lists of «أعمال دورية» (صلة الرحم…). */
  periodic: boolean;
  periodicTime: LocalTime;
  /** «بقي من يومك قليل…»: opt-in, off by default. */
  eveningNudge: boolean;
  eveningTime: LocalTime;
  /** The weekly review reminder (the keys keep their first name, Friday's): on by default. */
  fridayReview: boolean;
  fridayTime: LocalTime;
  /** The weekly review's day, 0 = Sunday … 6 = Saturday (practice-core `HeartPrefs.reviewDay`). */
  reviewDay: number;
  /** The private moment (generic check-in) reminder. Off by default; never on the server. */
  privateMoment: boolean;
  privateTime: LocalTime;
  /** «مناسبة قريبة» (round 5): the day before a non-weekly occasion. Opt-in, off by default. */
  occasions: boolean;
  occasionTime: LocalTime;
  /** The strategies reminded (round 6: planned again), one a week rotating. Empty: no strategy reminder. */
  strategies: string[];
  strategyTime: LocalTime;
  /** The strategy reminder's weekday, 0 = Sunday … 6 = Saturday (round 6). */
  strategyDay: number;
  /** «نية اليوم» reminder (round 6, opt-in). */
  intentionReminder: boolean;
  intentionTime: LocalTime;
  /** Plans whose reminders are off (habits and periodic plans), by id (round 6). */
  mutedPlans: string[];
  /** Periodic acts whose reminders are off, by `periodic.ts` key (`silat` = every people list) (round 6). */
  mutedActs: string[];
}

/** Ids kept in `mutedPlans` / `mutedActs` at most. */
export const MAX_MUTED = 100;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  habits: true,
  periodic: true,
  periodicTime: '18:00',
  eveningNudge: false,
  eveningTime: '21:00',
  fridayReview: true,
  fridayTime: '17:00',
  reviewDay: 5,
  privateMoment: false,
  privateTime: '21:00',
  occasions: false,
  occasionTime: '20:00',
  strategies: [],
  strategyTime: '10:00',
  strategyDay: STRATEGY_WEEKDAY,
  intentionReminder: false,
  intentionTime: '07:30',
  mutedPlans: [],
  mutedActs: [],
};

/** A tab of «التنبيهات» (round 6, C-19) and the prefs it holds, in order. No calendar file in any tab. */
export interface NotificationGroup {
  key: 'habits' | 'periodic' | 'heart' | 'strategies';
  prefs: readonly (keyof NotificationPrefs)[];
}

/**
 * «العادات» (each habit's own switch via `mutedPlans`, the private «تخفّف» moment on the app) · «الأعمال الدورية» (only
 * the member's active acts, each with a switch via `mutedActs` / `mutedPlans`; none → an add button; «مناسبة قريبة») ·
 * «النية والمحاسبة» (the intention, «محاسبة المساء» — one switch for the evening review and its nudge, as both clients
 * draw it — and the weekly review) · «الاستراتيجيات».
 */
export const NOTIFICATION_GROUPS: readonly NotificationGroup[] = [
  { key: 'habits', prefs: ['habits', 'mutedPlans', 'privateMoment', 'privateTime'] },
  { key: 'periodic', prefs: ['periodic', 'periodicTime', 'mutedActs', 'occasions', 'occasionTime'] },
  { key: 'heart', prefs: ['intentionReminder', 'intentionTime', 'eveningNudge', 'eveningTime', 'fridayReview', 'fridayTime', 'reviewDay'] },
  { key: 'strategies', prefs: ['strategies', 'strategyDay', 'strategyTime'] },
];

const PREF_BOOLS = ['habits', 'periodic', 'eveningNudge', 'fridayReview', 'privateMoment', 'occasions', 'intentionReminder'] as const;
const PREF_TIMES = ['periodicTime', 'eveningTime', 'fridayTime', 'privateTime', 'occasionTime', 'strategyTime', 'intentionTime'] as const;

const ids = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 80))].slice(0, MAX_MUTED) : [];

/** Never throws: unknown or invalid fields fall back to the defaults, unknown keys are dropped. */
export function parseNotificationPrefs(raw: unknown, defaults: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS): NotificationPrefs {
  const out: NotificationPrefs = {
    ...defaults,
    strategies: [...defaults.strategies],
    mutedPlans: [...defaults.mutedPlans],
    mutedActs: [...defaults.mutedActs],
  };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const k of PREF_BOOLS) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  for (const k of PREF_TIMES) if (isValidTime(r[k])) out[k] = r[k] as LocalTime;
  if (typeof r.reviewDay === 'number' && Number.isInteger(r.reviewDay) && r.reviewDay >= 0 && r.reviewDay <= 6) out.reviewDay = r.reviewDay;
  if (Array.isArray(r.strategies)) out.strategies = cleanStrategyKeys(r.strategies);
  if (typeof r.strategyDay === 'number' && Number.isInteger(r.strategyDay) && r.strategyDay >= 0 && r.strategyDay <= 6) out.strategyDay = r.strategyDay;
  if (Array.isArray(r.mutedPlans)) out.mutedPlans = ids(r.mutedPlans);
  if (Array.isArray(r.mutedActs)) out.mutedActs = ids(r.mutedActs);
  return out;
}

/** True inside the quiet hours (23:00 up to, not including, 05:00). */
export function isQuietTime(time: LocalTime): boolean {
  return time >= QUIET_START || time < QUIET_END;
}

export interface PlannedNotification {
  kind: NotificationKind;
  /** `habit:<planId>:<date>:<time>`, `periodic:<date>`, `evening:<date>`, `friday:<date>`, `private:<date>`, `digest:<date>`. */
  key: string;
  date: LocalDate;
  time: LocalTime;
  /** `habit`: the plan. */
  planId?: string;
  /** `periodic`: people due that day (ids, so a client that shows names by choice can find them). */
  relativeIds?: string[];
  /** `periodic`: people due; `digest`: acts merged into it. */
  count?: number;
  /** `occasion`: the catalog keys of the occasions that start tomorrow (usually one). */
  occasions?: string[];
  /** `occasion`: the day the occasions start (the entry's `date` + 1). */
  occasionDate?: LocalDate;
  /** `strategy`: the strategy of that week (round 6). */
  strategy?: string;
}

export interface NotificationPlanInput {
  store: Store;
  prefs: NotificationPrefs;
  /** The user's local day and time now: today's entries at or before `now` are left out. */
  today: LocalDate;
  now: LocalTime;
  /** Days planned from today (today included). */
  days: number;
  /** Which days a plan asks for (the same lookup as «ورد اليوم»). */
  dayOptions?: PlanDayOptions;
  /**
   * Prayer times per day for anchored slots («بعد الفجر»…). Unknown days (or no lookup) use the default prayer times.
   * The server passes the times the browser resolved and sent with its subscription.
   */
  prayerTimesOn?: PrayerTimesLookup;
  /** The catalog's suggested slots of a plan: a slot among them was not set by the user (quiet hours apply). */
  defaultSlotsOf?: (plan: Plan) => readonly LocalTime[] | undefined;
  /** The kinds this client delivers (default all). The server never plans `private`. */
  kinds?: readonly NotificationKind[];
  /** True when that Friday's review is already saved (no reminder). */
  reviewDoneOn?: (friday: LocalDate) => boolean;
  /** True when that day's «نية اليوم» is already made (no reminder). The server does not know it (device-local). */
  intentionDoneOn?: (date: LocalDate) => boolean;
  /**
   * The practice catalog's occasions (`GET /v1/practice/catalog` `occasions`), for «مناسبة قريبة». Absent: none. The
   * Hijri offset is the store's (`settings.hijriOffset`).
   */
  occasions?: readonly AgendaOccasion[];
  dailyCap?: number;
}

function byTime(a: PlannedNotification, b: PlannedNotification): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** True when a habit slot may ring in the quiet hours: the night prayer, or a time the user set himself. */
function quietExempt(plan: Plan, time: LocalTime, defaultSlotsOf: NotificationPlanInput['defaultSlotsOf']): boolean {
  if (plan.habitKey !== undefined && NIGHT_HABIT_KEYS.includes(plan.habitKey)) return true;
  // A prayer anchor is the user's own choice (after Fajr may be before 05:00 in summer).
  if (plan.slotAnchors?.some((a) => a !== null)) return true;
  const suggested = defaultSlotsOf?.(plan);
  return suggested === undefined || !suggested.includes(time);
}

function habitEntries(input: NotificationPlanInput, dates: readonly LocalDate[]): PlannedNotification[] {
  const { store, today, now, dayOptions = {} } = input;
  const out: PlannedNotification[] = [];
  const mutedPlans = new Set(input.prefs.mutedPlans ?? []);
  const mutedActs = new Set(input.prefs.mutedActs ?? []);
  for (const plan of store.plans) {
    if (reminderSlots(plan).length === 0 || mutedPlans.has(plan.id)) continue;
    const act = periodicActKeyOf(plan);
    if (act !== null && mutedActs.has(act)) continue;
    const periodic = isPeriodicPlan(plan, dayOptions);
    for (const date of dates) {
      if (isExcused(store, date) || !planAsksOn(plan, date, dayOptions)) continue;
      let slots = reminderSlots(plan, input.prayerTimesOn?.(date));
      if (periodic) slots = slots.slice(0, 1);
      if (date === today && (plan.log[today] ?? 0) >= requiredOn(plan, today)) continue;
      for (const time of slots) {
        if (date === today && time <= now) continue;
        if (isQuietTime(time) && !quietExempt(plan, time, input.defaultSlotsOf)) continue;
        out.push({ kind: 'habit', key: `habit:${plan.id}:${date}:${time}`, date, time, planId: plan.id });
      }
    }
  }
  return out;
}

function periodicEntries(input: NotificationPlanInput, end: LocalDate): PlannedNotification[] {
  const { store, prefs, today, now } = input;
  // Round 6: every people list is the act «صلة الرحم والأحباب» (`silat`).
  if ((prefs.mutedActs ?? []).includes('silat')) return [];
  const time = prefs.periodicTime;
  const firstDay = time > now ? today : addDays(today, 1);
  const byDate = new Map<LocalDate, string[]>();
  for (const rel of store.relatives) {
    if (!isRelativeOpen(rel)) continue;
    const due = nextDue(rel, today);
    const repeat = circleOf(rel) === 'sick' ? SICK_VISIT_EVERY_DAYS : PERIODIC_REPEAT_DAYS;
    for (let date = due < firstDay ? firstDay : due; date <= end; date = addDays(date, repeat)) {
      const ids = byDate.get(date) ?? [];
      ids.push(rel.id);
      byDate.set(date, ids);
    }
  }
  return [...byDate.entries()].map(([date, ids]) => ({
    kind: 'periodic' as const,
    key: `periodic:${date}`,
    date,
    time,
    relativeIds: ids,
    count: ids.length,
  }));
}

function eveningEntries(input: NotificationPlanInput, dates: readonly LocalDate[]): PlannedNotification[] {
  const { store, prefs, today, now, dayOptions = {} } = input;
  const time = prefs.eveningTime;
  const out: PlannedNotification[] = [];
  for (const date of dates) {
    if ((date === today && time <= now) || isExcused(store, date)) continue;
    const asked = store.plans.filter((p) => planAsksOn(p, date, dayOptions));
    if (asked.length === 0) continue;
    // Today the log is known; a later day is planned and re-planned away once it is done.
    if (date === today && asked.every((p) => (p.log[today] ?? 0) >= requiredOn(p, today))) continue;
    out.push({ kind: 'evening', key: `evening:${date}`, date, time });
  }
  return out;
}

function fridayEntries(input: NotificationPlanInput, dates: readonly LocalDate[]): PlannedNotification[] {
  const { store, prefs, today, now } = input;
  if (!store.plans.some((p) => !isPaused(p))) return [];
  const time = prefs.fridayTime;
  return dates
    .filter((date) => weekday(date) === prefs.reviewDay && !(date === today && time <= now) && !input.reviewDoneOn?.(date))
    .map((date) => ({ kind: 'friday' as const, key: `friday:${date}`, date, time }));
}

function privateEntries(input: NotificationPlanInput, dates: readonly LocalDate[]): PlannedNotification[] {
  const { store, prefs, today, now } = input;
  const programs = activePrograms(store.programs);
  if (programs.length === 0) return [];
  const checkedInToday = programs.some((p) => p.checkIns.some((c) => c.date === today));
  const time = prefs.privateTime;
  return dates
    .filter((date) => !(date === today && (time <= now || checkedInToday)))
    .map((date) => ({ kind: 'private' as const, key: `private:${date}`, date, time }));
}

/** Round 6: the weekly strategy reminder on the member's day and time, rotating the chosen strategies. */
function strategyEntries(input: NotificationPlanInput, dates: readonly LocalDate[]): PlannedNotification[] {
  const { prefs, today, now } = input;
  const keys = cleanStrategyKeys(prefs.strategies);
  if (keys.length === 0) return [];
  const day = prefs.strategyDay ?? STRATEGY_WEEKDAY;
  const out: PlannedNotification[] = [];
  for (const date of dates) {
    if (date === today && prefs.strategyTime <= now) continue;
    const strategy = strategyOfWeek(keys, date, day);
    if (strategy) out.push({ kind: 'strategy', key: `strategy:${date}`, date, time: prefs.strategyTime, strategy });
  }
  return out;
}

/** Round 6: «نية اليوم» reminder on each day not yet made (opt-in). Only while some habit is live. */
function intentionEntries(input: NotificationPlanInput, dates: readonly LocalDate[]): PlannedNotification[] {
  const { store, prefs, today, now } = input;
  if (!store.plans.some((p) => !isPaused(p))) return [];
  return dates
    .filter((date) => !(date === today && prefs.intentionTime <= now) && !isExcused(store, date) && !input.intentionDoneOn?.(date))
    .map((date) => ({ kind: 'intention' as const, key: `intention:${date}`, date, time: prefs.intentionTime }));
}

/**
 * True for an occasion rule that «مناسبة قريبة» reminds of: a Hijri day, window or monthly days, or a Gregorian day of
 * the month. Weekly and every-n-days rules (Mondays and Thursdays, Friday) are too frequent to announce.
 */
export function isRemindableOccasionRule(rule: Rule): boolean {
  return rule.kind === 'hijriYearly' || rule.kind === 'hijriWindow' || rule.kind === 'hijriMonthDays' || rule.kind === 'monthlyDay';
}

/**
 * The days an occasion starts between `from` and `to` (both inclusive): the first day of each run of consecutive
 * occasion days (the ten days remind once, before the first). A rule the runtime cannot evaluate (Hijri without
 * Umm al-Qura) gives none: a wrong date is worse than none.
 */
export function occasionStarts(occasion: Pick<AgendaOccasion, 'rule'>, from: LocalDate, to: LocalDate, hijriOffset = 0): LocalDate[] {
  let days: LocalDate[];
  try {
    days = occurrences(occasion.rule, addDays(from, -1), to, { hijriOffset });
  } catch {
    return [];
  }
  const set = new Set(days);
  return days.filter((d) => d >= from && !set.has(addDays(d, -1)));
}

/** «مناسبة قريبة»: one reminder the day before each occasion starts, at the user's time. */
function occasionEntries(input: NotificationPlanInput, dates: readonly LocalDate[]): PlannedNotification[] {
  const { prefs, today, now, store } = input;
  const occasions = (input.occasions ?? []).filter((o) => isRemindableOccasionRule(o.rule));
  if (occasions.length === 0 || dates.length === 0) return [];
  const first = dates[0] as LocalDate;
  const last = dates[dates.length - 1] as LocalDate;
  const byDay = new Map<LocalDate, string[]>();
  for (const o of occasions) {
    for (const start of occasionStarts(o, addDays(first, 1), addDays(last, 1), store.settings.hijriOffset)) {
      const day = addDays(start, -1);
      byDay.set(day, [...(byDay.get(day) ?? []), o.key]);
    }
  }
  const out: PlannedNotification[] = [];
  for (const [date, keys] of byDay) {
    if (date === today && prefs.occasionTime <= now) continue;
    out.push({ kind: 'occasion', key: `occasion:${date}`, date, time: prefs.occasionTime, occasions: keys, occasionDate: addDays(date, 1) });
  }
  return out;
}

/** How many acts a group of merged entries stands for: each habit once, each person due, the check-in once. */
function actsIn(entries: readonly PlannedNotification[]): number {
  const plans = new Set<string>();
  let others = 0;
  for (const e of entries) {
    if (e.kind === 'habit' && e.planId) plans.add(e.planId);
    else if (e.kind === 'periodic') others += e.count ?? 1;
    else if (e.kind === 'private') others += 1;
  }
  return plans.size + others;
}

/**
 * Keeps each day within `cap`: the first `cap - 1` entries ring as they are, the rest become one digest at the time
 * of the first of them (dropped when they hold no act: only nudges). Entries must be sorted.
 */
export function capPerDay(entries: readonly PlannedNotification[], cap = DAILY_CAP): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  let i = 0;
  while (i < entries.length) {
    const date = (entries[i] as PlannedNotification).date;
    let j = i;
    while (j < entries.length && (entries[j] as PlannedNotification).date === date) j++;
    const day = entries.slice(i, j);
    if (day.length <= cap) out.push(...day);
    else {
      const keep = day.slice(0, Math.max(0, cap - 1));
      const rest = day.slice(keep.length);
      out.push(...keep);
      const count = actsIn(rest);
      const first = rest[0] as PlannedNotification;
      if (count > 0) out.push({ kind: 'digest', key: `digest:${date}`, date, time: first.time, count });
    }
    i = j;
  }
  return out;
}

/** Everything to notify in the next `days` days under the policy, soonest first. */
export function notificationPlan(input: NotificationPlanInput): PlannedNotification[] {
  const { prefs, today } = input;
  if (input.days <= 0) return [];
  const kinds = new Set<NotificationKind>(input.kinds ?? NOTIFICATION_KINDS);
  const dates: LocalDate[] = [];
  for (let i = 0; i < input.days; i++) dates.push(addDays(today, i));
  const end = dates[dates.length - 1] as LocalDate;
  const all: PlannedNotification[] = [
    ...(kinds.has('habit') && prefs.habits ? habitEntries(input, dates) : []),
    ...(kinds.has('periodic') && prefs.periodic ? periodicEntries(input, end) : []),
    ...(kinds.has('evening') && prefs.eveningNudge ? eveningEntries(input, dates) : []),
    ...(kinds.has('friday') && prefs.fridayReview ? fridayEntries(input, dates) : []),
    ...(kinds.has('private') && prefs.privateMoment ? privateEntries(input, dates) : []),
    ...(kinds.has('intention') && prefs.intentionReminder ? intentionEntries(input, dates) : []),
  ].sort(byTime);
  const capped = capPerDay(all, input.dailyCap ?? DAILY_CAP);
  // «مناسبة قريبة» is information, at most one a day, chosen by the user: outside the daily cap, never in a digest.
  // The weekly strategy (round 6) is information too: outside the cap, like «مناسبة قريبة».
  const occasions = [
    ...(kinds.has('occasion') && prefs.occasions ? occasionEntries(input, dates) : []),
    ...(kinds.has('strategy') ? strategyEntries(input, dates) : []),
  ].sort(byTime);
  const out = [...capped];
  // Merged in by time; the capped entries keep their order.
  for (const o of occasions) {
    const at = out.findIndex((e) => e.date > o.date || (e.date === o.date && e.time > o.time));
    if (at < 0) out.push(o);
    else out.splice(at, 0, o);
  }
  return kinds.has('digest') ? out : out.filter((e) => e.kind !== 'digest');
}

/** Minutes from local midnight of a planned entry (for clients that build a Date). */
export function entryMinutes(entry: Pick<PlannedNotification, 'time'>): number {
  return timeToMinutes(entry.time);
}

/**
 * The generic words of the policy's own notifications, the same on every client. Habit and people texts stay with each
 * client's existing templates. None names a sin, a person or a failure.
 */
export const NOTIFY_TEXTS = {
  ar: {
    wirdTitle: 'ورد اليوم',
    eveningBody: 'بقي من يومك قليل، ودقيقة واحدة تحفظ مداومتك',
    fridayTitle: 'المحاسبة',
    fridayBody: 'دقيقتان مع نفسك: ما ثبتَّ عليه هذا الأسبوع، وخطوة للأسبوع القادم',
    digestBody: (n: number) => `عندك ${arabicActs(n)} اليوم`,
    occasionTitle: 'مناسبة قريبة',
    /** `title`: the occasion's catalog title (the first, when two start the same day). */
    occasionBody: (title: string) => `غدًا: ${title}`,
    strategyTitle: 'استراتيجية الأسبوع',
    strategyBody: (key: string) => strategyByKey(key)?.titleAr ?? '',
    intentionTitle: 'نية اليوم',
    intentionBody: 'دقيقة تجدّد فيها نيتك لهذا اليوم',
  },
  en: {
    wirdTitle: "Today's practice",
    eveningBody: 'Little is left of your day; one minute keeps your streak',
    fridayTitle: 'Self-review',
    fridayBody: 'Two minutes with yourself: what you kept this week, and one step for the next',
    digestBody: (n: number) => (n === 1 ? 'You have 1 act today' : `You have ${n} acts today`),
    occasionTitle: 'Coming occasion',
    occasionBody: (title: string) => `Tomorrow: ${title}`,
    strategyTitle: 'Strategy of the week',
    strategyBody: (key: string) => strategyByKey(key)?.titleEn ?? '',
    intentionTitle: "Today's intention",
    intentionBody: 'A minute to renew your intention for today',
  },
} as const;

/** «عمل واحد», «عملان», «3 أعمال», «11 عملًا». Western digits. */
export function arabicActs(n: number): string {
  if (n === 1) return 'عمل واحد';
  if (n === 2) return 'عملان';
  if (n >= 3 && n <= 10) return `${n} أعمال`;
  return `${n} عملًا`;
}
