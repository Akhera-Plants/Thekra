/**
 * Hooks of the «عاداتي» hub: the selected day and the visible week and month, the day's agenda and the presence
 * marks (practice-core `dayAgenda` / `presence`, memoized for the visible range only), the quick log with its undo,
 * «يومي ثقيل», and the counts on the track rows. Every edit goes through practice-core store helpers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  activePrograms,
  addDays,
  correctLog,
  dayAgenda,
  endEbb,
  logContact,
  logDone,
  removeContact,
  minDate,
  monthSummary,
  presence,
  startEbb,
  updatePlan,
  updateRelative,
  type AdherenceBand,
  type AgendaItem,
  type HabitItem,
  type LocalDate,
  type RelativeItem,
  type Store,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useCirclePresence } from '@/lib/circles/use-circle-presence';
import { pick } from './catalog-types';
import { addMonths, firstWeekday, followToday, monthStart, weekDays, type DateNames } from './calendar-grid';
import { dueNowCount, finishedDay, hasStarted, presenceMarks, type PresenceMark } from './hub';
import { eachPlan } from './plan-view';
import { today, usePracticeStore } from './practice-store';
import { formatAmount, habitFor } from './reminders';
import { useUiLocale } from './use-practice-lifecycle';

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

/** How often an open hub checks whether the date changed (it also checks on every return to the foreground). */
const TODAY_CHECK_MS = 60_000;

/**
 * The selected day (today at first), its week in reading order, and the month the grid shows. «Today» follows the
 * clock: past midnight or back from the background on another day, it moves on, and so does a selection that was
 * on it (`followToday`); a day the user picked stays.
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
  const shiftWeek = useCallback((delta: number) => select(addDays(selected, 7 * delta)), [select, selected]);
  const shiftMonth = useCallback((delta: number) => setMonth((m) => addMonths(m, delta)), []);
  const goToday = useCallback(() => {
    const now = today();
    setToday(now);
    select(now);
  }, [select]);
  const week = useMemo(() => weekDays(selected, first), [selected, first]);

  return { today: d, selected, month, week, first, select, shiftWeek, shiftMonth, goToday };
}

/** Everything the selected day asks for (occasions from the practice catalog, Hijri-aware with the user's offset). */
export function useDayAgenda(date: LocalDate): AgendaItem[] {
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const occasions = usePracticeCatalog(locale).data?.occasions;
  return useMemo(
    () => dayAgenda(store, date, { occasions, hijriOffset: store.settings.hijriOffset }),
    [store, date, occasions],
  );
}

/** One row of the day list, with its words ready (titles from the catalog, amounts as the plan screens write them). */
export type AgendaRowModel =
  | { key: string; kind: 'occasion'; title: string; deed: string }
  | { key: string; kind: 'habit'; item: HabitItem; title: string; meta: string }
  | { key: string; kind: 'relative'; item: RelativeItem; title: string; relation: string; meta: string }
  | { key: string; kind: 'program'; done: boolean; meta: string };

/** The rows of the day list from its agenda. The program row never carries anything but generic words. */
export function useAgendaRows(items: readonly AgendaItem[], date: LocalDate, todayDate: LocalDate): AgendaRowModel[] {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const plans = usePracticeStore((s) => s.store.plans);
  const relatives = usePracticeStore((s) => s.store.relatives);
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
        const required = t('practice.hub.required', { amount: amount(item.required) });
        const meta = item.done > 0 ? `${required} · ${t('practice.hub.logged', { amount: amount(item.done) })}` : required;
        rows.push({ key: `h-${item.planId}`, kind: 'habit', item, title: habit ? pick(habit, 'title', locale) : plan.title, meta });
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
        rows.push({ key: `r-${item.relativeId}`, kind: 'relative', item, title: rel.name, relation: rel.relation, meta });
      } else {
        const meta = item.done
          ? t(isToday ? 'practice.hub.programDone' : 'practice.hub.programDoneDay')
          : t(isToday ? 'practice.hub.programPending' : 'practice.hub.programOpen');
        rows.push({ key: 'program', kind: 'program', done: item.done, meta });
      }
    }
    return rows;
  }, [items, date, todayDate, plans, relatives, habits, locale, t]);
}

/** Presence marks from `from` to `to`, computed up to today only (the future has no mark). */
export function usePresenceMarks(from: LocalDate, to: LocalDate, todayDate: LocalDate): Map<LocalDate, PresenceMark> {
  const store = usePracticeStore((s) => s.store);
  return useMemo(
    () => (from > todayDate ? new Map() : presenceMarks(presence(store, from, minDate(to, todayDate)))),
    [store, from, to, todayDate],
  );
}

/** The last quick log on the hub, shown as «سُجِّل · تراجع» on its row. */
/** The last tick or untick of the day list; «تراجع» puts back exactly what was there before it. */
export type HubLastLog =
  | { kind: 'habit'; planId: string; date: LocalDate; before: number; cleared: boolean }
  | { kind: 'relative'; relativeId: string; date: LocalDate; cleared: boolean };

/**
 * The check controls of the day list. A habit's check logs what is left of the day (practice-core `logDone`); on a
 * complete habit it puts back the amount from before the hub's own log (`correctLog`), or clears the day when the
 * hub did not log it. A relative's check is «تواصلت معه» for that day; on a done one it removes that day's contact
 * (`updateRelative` records the tombstone). Every tick and untick can be undone inline, so a stray tap never loses
 * a logged amount. One light haptic on a habit's tick (with the supplication the hub shows), and when a relative's
 * tap finishes the day.
 */
export function useAgendaActions(date: LocalDate) {
  useCirclePresence(); // «حضرت اليوم» to the user's circles (رفقة), when sharing is on there
  const setStore = usePracticeStore((s) => s.setStore);
  const [lastLog, setLastLog] = useState<HubLastLog | null>(null);
  const before = useRef(new Map<string, number>());

  /** Applies an edit; a light confirmation on a tick (`tick`) or when it closed the day's last open task. */
  const apply = useCallback(
    (edit: (s: Store) => Store, tick = false) => {
      const prev = usePracticeStore.getState().store;
      setStore(edit);
      if (tick || finishedDay(prev, usePracticeStore.getState().store, date)) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [date, setStore],
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
      apply((s) => updatePlan(s, item.planId, (p) => logDone(p, date, item.remaining)), true);
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
      apply((s) => updateRelative(s, item.relativeId, (r) => logContact(r, date)));
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

  return { lastLog, toggleHabit, toggleRelative, undo };
}

/** «يومي ثقيل»: on = every plan at its minimum from today (practice-core `startEbb`), off = back to the plan. */
export function useHeavyDay() {
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const hasPlans = plans.length > 0;
  const heavy = hasPlans && plans.every((p) => p.ebb);
  const setHeavy = useCallback(
    (on: boolean) => {
      const d = today();
      setStore((s) => eachPlan(s, (p) => (on ? (p.ebb ? null : startEbb(p, d)) : p.ebb ? endEbb(p) : null)));
    },
    [setStore],
  );
  return { hasPlans, heavy, setHeavy };
}

/** What the track rows and «وين وصلت» say. */
export interface TrackSummary {
  /** Anything started at all (else the hub shows the three ways to begin). */
  started: boolean;
  habits: number;
  /** The kind band of the last 30 days, null without plans. */
  band: AdherenceBand | null;
  /** Days with anything done in the last 30 days («أي قدر يُحسب»). */
  presentDays: number;
  relativesDue: number;
  hasRelatives: boolean;
  hasProgram: boolean;
}

/** What the three track rows say: habits and their band, relatives due now, whether a program runs. */
export function useTrackSummary(todayDate: LocalDate): TrackSummary {
  const store = usePracticeStore((s) => s.store);
  return useMemo(() => {
    const month = monthSummary(store, todayDate);
    return {
      started: hasStarted(store),
      habits: store.plans.length,
      band: month.band,
      presentDays: month.presentDays,
      relativesDue: dueNowCount(store.relatives, todayDate),
      hasRelatives: store.relatives.length > 0,
      hasProgram: activePrograms(store.programs).length > 0,
    };
  }, [store, todayDate]);
}
