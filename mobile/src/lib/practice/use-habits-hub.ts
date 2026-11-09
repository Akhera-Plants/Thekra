/**
 * Hooks of «عاداتي › اليوم» and «سجلّي»: today (following the clock) and the month the grid shows, the day's agenda and
 * the presence marks (practice-core `dayAgenda` / `presence`, memoized for the visible range only), the quick log with
 * its undo, «يومي ثقيل» (kept for the garden; «حال يومي» is practice-core `setDayState`), the streak (practice-core
 * `currentStreak` / `longestStreak`), the month summary and the limits. Every edit goes through practice-core store
 * helpers. The periodic acts' rows are built in «الأعمال الدورية» itself (practice-core `activePeriodicActs`).
 *
 * A habit is asked for only on its own days (practice-core `planAsksOn` / `isPlanDueOn`: its rule, else the catalog
 * habit's default rule, else daily), the same answer the reminders use; on other days it stays loggable in the
 * collapsed «اليوم استراحة» row and is never counted as missed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  correctLog,
  currentStreak,
  dayAgenda,
  limits,
  logContact,
  logForDay,
  logMinimum,
  makeUpOffer,
  minimumMet,
  minimumToLog,
  longestStreak,
  streakDisplay,
  removeContact,
  minDate,
  monthSummary,
  offDayItems,
  presence,
  updatePlan,
  updateRelative,
  type AdherenceBand,
  type AgendaItem,
  type HabitItem,
  type LocalDate,
  type PlanDayOptions,
  type RelativeItem,
  type Limits,
  type Store,
  type StreakDisplay,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useCirclePresence } from '@/lib/circles/use-circle-presence';
import { pick } from './catalog-types';
import { addMonths, dayMonth, firstWeekday, followToday, monthStart, type DateNames } from './calendar-grid';
import { finishedDay, presenceMarks, type PresenceMark } from './hub';
import { heavyDayOn, setHeavyDay } from './plan-view';
import { today, usePracticeStore } from './practice-store';
import { formatAmount, habitFor } from './reminders';
import { useUiLocale } from './use-practice-lifecycle';
import type { AgendaRowModel } from './wird';

export type { AgendaRowModel } from './wird';

/** Weekday, Gregorian and Hijri month names from i18n (Western digits are added by the label helpers). */
export function useDateNames(): DateNames {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      weekday: (day: number) => t(`practice.weekdays.${day}`),
      gregorianMonth: (month: number) => t(`practice.hub.months.${month}`),
      hijriMonth: (month: number) => t(`calendar.hijriMonths.${month}`),
    }),
    [t],
  );
}

/**
 * A short date in words for lines and lists, «7 نوفمبر» / «7 November» (owner rule F-30 / C-23: month names, Western
 * digits, never «7/11»).
 */
export function useShortDate(): (date: LocalDate) => string {
  const names = useDateNames();
  return useCallback((date: LocalDate) => dayMonth(date.slice(0, 10) as LocalDate, names), [names]);
}

/** How often an open hub checks whether the date changed (it also checks on every return to the foreground). */
const TODAY_CHECK_MS = 60_000;

/**
 * Today, the selected day (today at first) and the month the grid shows. «Today» follows the clock: past midnight or
 * back from the background on another day, it moves on, and so does a selection that was on it (`followToday`); a
 * day the user picked stays.
 */
export function useHubDays() {
  const locale = useUiLocale();
  const first = firstWeekday(locale);
  const [d, setToday] = useState(today);
  const [selected, setSelected] = useState(d);
  const [month, setMonth] = useState(() => monthStart(d));
  const viewRef = useRef({ today: d, selected, month });
  viewRef.current = { today: d, selected, month };

  useEffect(() => {
    function refreshToday() {
      const { today: previous, selected: sel, month: shown } = viewRef.current;
      const now = today();
      if (now === previous) return;
      const next = followToday({ selected: sel, month: shown }, previous, now);
      setToday(now);
      setSelected(next.selected);
      setMonth(next.month);
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshToday();
    });
    const timer = setInterval(refreshToday, TODAY_CHECK_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  const select = useCallback((date: LocalDate) => {
    setSelected(date);
    setMonth(monthStart(date));
  }, []);
  const shiftMonth = useCallback((delta: number) => setMonth((m) => addMonths(m, delta)), []);

  return { today: d, selected, month, first, select, shiftMonth };
}

/**
 * Which days each plan asks for: the user's Hijri offset and the catalog habit's default rule for plans without a
 * rule of their own (the same lookup as the reminders' `planDueOn`).
 */
export function usePlanDays(): PlanDayOptions {
  const locale = useUiLocale();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const habits = usePracticeCatalog(locale).data?.habits;
  return useMemo(
    () => ({ hijriOffset, defaultRuleOf: (plan) => habitFor(plan, habits ?? [])?.defaultRule }),
    [hijriOffset, habits],
  );
}

/** Everything the selected day asks for (occasions from the practice catalog, Hijri-aware with the user's offset). */
export function useDayAgenda(date: LocalDate): AgendaItem[] {
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const occasions = usePracticeCatalog(locale).data?.occasions;
  const planDays = usePlanDays();
  return useMemo(() => dayAgenda(store, date, { occasions, ...planDays }), [store, date, occasions, planDays]);
}

/**
 * Habits the day does not ask for (not their days), as habit items with their usual amount: still loggable from the
 * collapsed «اليوم استراحة» row, never counted as missed.
 */
export function useOffDayHabits(date: LocalDate): HabitItem[] {
  const store = usePracticeStore((s) => s.store);
  const planDays = usePlanDays();
  return useMemo(() => offDayItems(store, date, planDays), [store, date, planDays]);
}

/**
 * The rows of the day list from its agenda. A relative is a periodic act («صلة الرحم» before its status); the program
 * row never carries anything but generic words.
 */
export function useAgendaRows(items: readonly AgendaItem[], date: LocalDate, todayDate: LocalDate): AgendaRowModel[] {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const planDays = usePlanDays();
  const plans = store.plans;
  const relatives = store.relatives;
  const habits = usePracticeCatalog(locale).data?.habits;
  return useMemo(() => {
    const isToday = date === todayDate;
    const unitFallback = {
      minutes: t('practice.units.minutes'),
      count: t('practice.units.count'),
      times: t('practice.units.times'),
    };
    const rows: AgendaRowModel[] = [];
    for (const item of items) {
      if (item.kind === 'occasion') {
        rows.push({ key: `o-${item.key}`, kind: 'occasion', title: pick(item, 'title', locale), deed: item.deed });
      } else if (item.kind === 'habit') {
        const plan = plans.find((p) => p.id === item.planId);
        if (!plan) continue;
        const habit = habitFor(plan, habits ?? []);
        const amount = (n: number) => formatAmount(n, plan.unit, habit, locale, unitFallback);
        // «لا تفوّتها مرتين»: missed yesterday, so the row asks for its minimum with one gentle line. The asked amount
        // stays the same once «أقل ما يمكن» is logged (A-23: it no longer jumps to the full amount).
        const missed = item.missedYesterday && item.minimum && (item.done === 0 || minimumMet(plan, date));
        // Two days missed in a row (the «صلّحها» offer is open): «انقطعت يومين…» instead of «لا تفوّتها مرتين» (web parity).
        const twice = missed && isToday && makeUpOffer(store, plan, date, { ...planDays, heart }) !== null;
        const required = missed
          ? `${t(twice ? 'practice.hub.missedTwice' : 'practice.hub.missedYesterday')} · ${t('practice.hub.required', { amount: amount(item.minimum as number) })}`
          : t('practice.hub.required', { amount: amount(item.required) });
        const meta = minimumMet(plan, date)
          ? `${required} · ${t('practice.heart.minimumMet')}`
          : item.done > 0
            ? `${required} · ${t('practice.hub.logged', { amount: amount(item.done) })}`
            : required;
        const canMinimum = !item.complete && minimumToLog(plan, date) !== null;
        rows.push({ key: `h-${item.planId}`, kind: 'habit', item, title: habit ? pick(habit, 'title', locale) : plan.title, meta, canMinimum });
      } else if (item.kind === 'relative') {
        const rel = relatives.find((r) => r.id === item.relativeId);
        if (!rel) continue;
        const meta = item.done
          ? isToday
            ? t('kinship.contactedToday')
            : t('practice.hub.relativeContactedDay')
          : item.overdueDays === 0 && !isToday
            ? t('practice.hub.relativeDueDay')
            : t('practice.hub.relativeOverdue', { count: item.overdueDays });
        rows.push({
          key: `r-${item.relativeId}`,
          kind: 'relative',
          item,
          title: rel.name,
          relation: rel.relation,
          meta: `${t('kinship.title')} · ${meta}`,
        });
      } else {
        const meta = item.done
          ? t(isToday ? 'practice.hub.programDone' : 'practice.hub.programDoneDay')
          : t(isToday ? 'practice.hub.programPending' : 'practice.hub.programOpen');
        rows.push({ key: 'program', kind: 'program', done: item.done, meta });
      }
    }
    return rows;
  }, [items, date, todayDate, store, heart, planDays, plans, relatives, habits, locale, t]);
}

/** Presence marks from `from` to `to`, computed up to today only (the future has no mark). */
export function usePresenceMarks(from: LocalDate, to: LocalDate, todayDate: LocalDate): Map<LocalDate, PresenceMark> {
  const store = usePracticeStore((s) => s.store);
  const planDays = usePlanDays();
  return useMemo(
    () => (from > todayDate ? new Map() : presenceMarks(presence(store, from, minDate(to, todayDate), planDays))),
    [store, from, to, todayDate, planDays],
  );
}

/** The last tick or untick of the day list; «تراجع» puts back exactly what was there before it. */
export type HubLastLog =
  | { kind: 'habit'; planId: string; date: LocalDate; before: number; cleared: boolean }
  | { kind: 'relative'; relativeId: string; date: LocalDate; cleared: boolean };

/**
 * The check controls of the day list. A habit's check logs what is left of the day (practice-core `logDone`); on a
 * complete habit it puts back the amount from before the hub's own log (`correctLog`), or clears the day when the
 * hub did not log it. A relative's check is «تواصلت معه» for that day; on a done one it removes that day's contact
 * (`updateRelative` records the tombstone). Every tick and untick can be undone inline, so a stray tap never loses
 * a logged amount. A light haptic on each tick, a success haptic when the tap finishes the day.
 */
export function useAgendaActions(date: LocalDate) {
  useCirclePresence(); // «حضرت اليوم» to the user's circles (رفقة), when sharing is on there
  const setStore = usePracticeStore((s) => s.setStore);
  const planDays = usePlanDays();
  const [lastLog, setLastLog] = useState<HubLastLog | null>(null);
  // «تقبّل الله منك»: the time of the last tick (not an untick), so the screen shows it for a moment.
  const [cheerAt, setCheerAt] = useState<number | null>(null);
  const before = useRef(new Map<string, number>());

  /**
   * Applies an edit. A tick answers with a light haptic and «تقبّل الله منك»; the tick that closes the day's last open
   * task with a success haptic instead.
   */
  const apply = useCallback(
    (edit: (s: Store) => Store, tick = false) => {
      const prev = usePracticeStore.getState().store;
      setStore(edit);
      if (finishedDay(prev, usePracticeStore.getState().store, date, planDays)) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (tick) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (tick) setCheerAt(Date.now());
    },
    [date, setStore, planDays],
  );

  const toggleHabit = useCallback(
    (item: HabitItem) => {
      const key = `${item.planId}|${date}`;
      if (item.complete) {
        const amount = before.current.get(key) ?? 0;
        before.current.delete(key);
        apply((s) => updatePlan(s, item.planId, (p) => correctLog(p, date, amount)));
        setLastLog({ kind: 'habit', planId: item.planId, date, before: item.done, cleared: true });
        return;
      }
      before.current.set(key, item.done);
      // «قضاء»: today, and yesterday until noon, log plainly; an older day is saved but does not count for the streak.
      const amount = item.missedYesterday && item.done === 0 && item.minimum ? item.minimum : item.remaining;
      apply((s) => updatePlan(s, item.planId, (p) => logForDay(p, date, amount, today())), true);
      setLastLog({ kind: 'habit', planId: item.planId, date, before: item.done, cleared: false });
    },
    [date, apply],
  );

  const toggleRelative = useCallback(
    (item: RelativeItem) => {
      if (item.done) {
        apply((s) => removeContact(s, item.relativeId, date));
        setLastLog({ kind: 'relative', relativeId: item.relativeId, date, cleared: true });
        return;
      }
      apply((s) => updateRelative(s, item.relativeId, (r) => logContact(r, date)), true);
      setLastLog({ kind: 'relative', relativeId: item.relativeId, date, cleared: false });
    },
    [date, apply],
  );

  const undo = useCallback(() => {
    if (!lastLog) return;
    if (lastLog.kind === 'habit') {
      before.current.delete(`${lastLog.planId}|${lastLog.date}`);
      setStore((s) => updatePlan(s, lastLog.planId, (p) => correctLog(p, lastLog.date, lastLog.before)));
    } else if (lastLog.cleared) {
      setStore((s) => updateRelative(s, lastLog.relativeId, (r) => logContact(r, lastLog.date)));
    } else {
      setStore((s) => removeContact(s, lastLog.relativeId, lastLog.date));
    }
    setLastLog(null);
  }, [lastLog, setStore]);

  /** «أقل ما يمكن»: the heavy-day minimum for the day (it counts for the streak). */
  const logMinimumFor = useCallback(
    (item: HabitItem) => {
      before.current.set(`${item.planId}|${date}`, item.done);
      apply((s) => updatePlan(s, item.planId, (p) => logMinimum(p, date, today())), true);
      setLastLog({ kind: 'habit', planId: item.planId, date, before: item.done, cleared: false });
    },
    [date, apply],
  );

  return { lastLog, cheerAt, toggleHabit, toggleRelative, undo, logMinimum: logMinimumFor };
}

/**
 * «يومي ثقيل» is one day (practice-core `isEbbOn`): on = every plan at its minimum for today only (`startEbb`), off =
 * back to the plan the same day. The switch is on only when every plan is lightened today; tomorrow it is off by
 * itself, with nothing to undo.
 */
export function useHeavyDay(todayDate: LocalDate = today()) {
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const hasPlans = plans.length > 0;
  const heavy = heavyDayOn(plans, todayDate);
  const setHeavy = useCallback(
    (on: boolean) => {
      setStore((s) => setHeavyDay(s, on, today()));
    },
    [setStore],
  );
  return { hasPlans, heavy, setHeavy };
}

/** What «سجلّي» says of the last 30 days: days with anything done and the kind band of the plans. */
export interface MonthPresence {
  presentDays: number;
  /** The kind band of the last 30 days, null without plans. */
  band: AdherenceBand | null;
}

/** Days present in the last 30 and the plans' band (practice-core `monthSummary`). */
export function useMonthPresence(todayDate: LocalDate): MonthPresence {
  const store = usePracticeStore((s) => s.store);
  const planDays = usePlanDays();
  return useMemo(() => {
    const month = monthSummary(store, todayDate, undefined, planDays);
    return { presentDays: month.presentDays, band: month.band };
  }, [store, todayDate, planDays]);
}

/**
 * The streak of complete days and the longest one (practice-core `currentStreak` / `longestStreak`), and how to show
 * it (`streakDisplay`: never 0 as a failure).
 */
export function useStreak(todayDate: LocalDate): { current: number; longest: number; display: StreakDisplay; hasPlans: boolean } {
  const store = usePracticeStore((s) => s.store);
  const planDays = usePlanDays();
  return useMemo(() => {
    const current = currentStreak(store, todayDate, planDays);
    const longest = longestStreak(store, todayDate, planDays);
    return { current, longest, display: streakDisplay(current, longest), hasPlans: store.plans.length > 0 };
  }, [store, todayDate, planDays]);
}

/** The limits (3 young habits, 7 periodic acts, 3 «تخفَّف» programs); periodic acts come from the catalog's templates. */
export function useLimits(todayDate: LocalDate = today()): Limits {
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const habits = usePracticeCatalog(locale).data?.habits;
  return useMemo(
    () => limits(store, todayDate, { isPeriodicAct: (plan) => habitFor(plan, habits ?? [])?.kind === 'periodic' }),
    [store, todayDate, habits],
  );
}
