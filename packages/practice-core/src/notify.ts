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
 * - Friday review reminder (on by default): Friday at {@link DEFAULT_NOTIFICATION_PREFS}.fridayTime, unless saved.
 * - The private moment reminder (the sin program's generic check-in): unchanged, generic, never a name.
 * - «ذكّرني بها» (opt-in): at most one strategy a week, on Saturday at the user's time (strategies.ts).
 * - Quiet hours {@link QUIET_START}–{@link QUIET_END}: nothing the policy chose rings inside them. A habit slot inside
 *   them rings only for the night prayer ({@link NIGHT_HABIT_KEYS}) or when the user set that time himself (it is not
 *   one of the catalog's suggested slots). Times the user picks in «التنبيهات» are his own choice.
 * - At most {@link DAILY_CAP} a day: past that, the rest of the day is one digest «عندك n أعمال اليوم».
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
import { cleanStrategyKeys, strategyByKey, strategyOfWeek } from './strategies.js';
import type { PrayerTimesLookup } from './prayer.js';

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

export type NotificationKind = 'habit' | 'periodic' | 'evening' | 'friday' | 'private' | 'strategy' | 'digest';

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
  /** The Friday review reminder: on by default. */
  fridayReview: boolean;
  fridayTime: LocalTime;
  /** The private moment (generic check-in) reminder. Off by default; never on the server. */
  privateMoment: boolean;
  privateTime: LocalTime;
  /** «ذكّرني بها»: the strategies chosen on «استراتيجيات العادات» (opt-in, empty by default); one a week at most. */
  strategies: string[];
  strategyTime: LocalTime;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  habits: true,
  periodic: true,
  periodicTime: '18:00',
  eveningNudge: false,
  eveningTime: '21:00',
  fridayReview: true,
  fridayTime: '17:00',
  privateMoment: false,
  privateTime: '21:00',
  strategies: [],
  strategyTime: '10:00',
};

const PREF_BOOLS = ['habits', 'periodic', 'eveningNudge', 'fridayReview', 'privateMoment'] as const;
const PREF_TIMES = ['periodicTime', 'eveningTime', 'fridayTime', 'privateTime', 'strategyTime'] as const;

/** Never throws: unknown or invalid fields fall back to the defaults, unknown keys are dropped. */
export function parseNotificationPrefs(raw: unknown, defaults: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS): NotificationPrefs {
  const out: NotificationPrefs = { ...defaults, strategies: [...defaults.strategies] };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const k of PREF_BOOLS) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  for (const k of PREF_TIMES) if (isValidTime(r[k])) out[k] = r[k] as LocalTime;
  if (Array.isArray(r.strategies)) out.strategies = cleanStrategyKeys(r.strategies);
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
  /** `strategy`: the key of the strategy of the week (practice-core `STRATEGIES`). */
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
  for (const plan of store.plans) {
    if (reminderSlots(plan).length === 0) continue;
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
    .filter((date) => weekday(date) === 5 && !(date === today && time <= now) && !input.reviewDoneOn?.(date))
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

/** «ذكّرني بها»: one chosen strategy a week, on {@link STRATEGY_WEEKDAY}, at the user's time. */
function strategyEntries(input: NotificationPlanInput, dates: readonly LocalDate[]): PlannedNotification[] {
  const { prefs, today, now } = input;
  const out: PlannedNotification[] = [];
  for (const date of dates) {
    const strategy = strategyOfWeek(prefs.strategies, date);
    if (!strategy || (date === today && prefs.strategyTime <= now)) continue;
    out.push({ kind: 'strategy', key: `strategy:${date}`, date, time: prefs.strategyTime, strategy });
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
  const kinds = new Set<NotificationKind>(input.kinds ?? ['habit', 'periodic', 'evening', 'friday', 'private', 'strategy', 'digest']);
  const dates: LocalDate[] = [];
  for (let i = 0; i < input.days; i++) dates.push(addDays(today, i));
  const end = dates[dates.length - 1] as LocalDate;
  const all: PlannedNotification[] = [
    ...(kinds.has('habit') && prefs.habits ? habitEntries(input, dates) : []),
    ...(kinds.has('periodic') && prefs.periodic ? periodicEntries(input, end) : []),
    ...(kinds.has('evening') && prefs.eveningNudge ? eveningEntries(input, dates) : []),
    ...(kinds.has('friday') && prefs.fridayReview ? fridayEntries(input, dates) : []),
    ...(kinds.has('private') && prefs.privateMoment ? privateEntries(input, dates) : []),
    ...(kinds.has('strategy') && prefs.strategies.length > 0 ? strategyEntries(input, dates) : []),
  ].sort(byTime);
  const capped = capPerDay(all, input.dailyCap ?? DAILY_CAP);
  return kinds.has('digest') ? capped : capped.filter((e) => e.kind !== 'digest');
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
    strategyTitle: 'استراتيجية الأسبوع',
    strategyBody: (key: string) => strategyByKey(key)?.titleAr ?? '',
  },
  en: {
    wirdTitle: "Today's wird",
    eveningBody: 'Little is left of your day; one minute keeps your streak',
    fridayTitle: 'Self-review',
    fridayBody: 'Two minutes with yourself: what you kept this week, and one step for the next',
    digestBody: (n: number) => (n === 1 ? 'You have 1 act today' : `You have ${n} acts today`),
    strategyTitle: 'Strategy of the week',
    strategyBody: (key: string) => strategyByKey(key)?.titleEn ?? '',
  },
} as const;

/** «عمل واحد», «عملان», «3 أعمال», «11 عملًا». Western digits. */
export function arabicActs(n: number): string {
  if (n === 1) return 'عمل واحد';
  if (n === 2) return 'عملان';
  if (n >= 3 && n <= 10) return `${n} أعمال`;
  return `${n} عملًا`;
}
