/**
 * View-model builders for «أعِنّي على طاعة». All numbers and rules come from @thekra/practice-core
 * (start amounts, ladder, hold, adherence bands, ebb, season, relapse, load); this file only shapes them
 * for the page and builds the reminder calendar file.
 */
import {
  addDays,
  adherence,
  adherenceBand,
  buildIcs,
  canIncrease,
  createPlan,
  diffDays,
  eachDay,
  HOLD_DAYS,
  isHijriSupported,
  nextStep,
  occurrences,
  occurrencesToEvents,
  relapseSuggestion,
  requiredOn,
  status,
  timeToMinutes,
  toHijri,
  baseAmount,
  endEbb,
  startEbb,
  updatePlan,
  type AdherenceBand,
  type IcsEvent,
  type LocalDate,
  type Plan,
  type Rule,
  type Store,
} from '@thekra/practice-core';
import type { PracticeHabit } from '@/lib/types/practice';
import { newUuid } from './ids';

/** The catalog habit of a plan (`habitKey`; plans from before accounts used the key as their id). */
export function habitOf(plan: Plan, habits: ReadonlyMap<string, PracticeHabit>): PracticeHabit | undefined {
  return habits.get(plan.habitKey ?? plan.id);
}

/** Active days a week at the beginning (lecture: 3 + 4 at the start). */
export const DEFAULT_ACTIVE_DAYS = 3;
/** The lecture asks for at least two times a day to do a habit. */
export const SUGGESTED_SLOTS = 2;
/** Days shown in «وين وصلت». */
export const PROGRESS_DAYS = 28;
/** Window of the monthly adherence band. */
export const MONTH_DAYS = 30;
export const REMINDER_DAYS = 30;

export type Distance = 'far' | 'near';

export interface PlanChoice {
  distance: Distance;
  slots: string[];
  activeDaysPerWeek: number;
}

/** A plan for a catalog habit: a client UUID (the server's id), with the habit key kept as `habitKey`. */
export function planFromHabit(habit: PracticeHabit, choice: PlanChoice, today: LocalDate, id: string = newUuid()): Plan {
  const amount = habit.start[choice.distance];
  return createPlan({
    id,
    habitKey: habit.key,
    deedSlug: habit.deed,
    title: habit.titleAr,
    unit: habit.unit,
    amount: habit.ceiling !== undefined ? Math.min(amount, habit.ceiling) : amount,
    ceiling: habit.ceiling,
    activeDaysPerWeek: choice.activeDaysPerWeek,
    slots: [...new Set(choice.slots)].sort(),
    createdOn: today,
  });
}

export interface PlanToday {
  required: number;
  done: number;
  remaining: number;
  isComplete: boolean;
  /** Something done, not all of it: the «خربانة؟ صلّحها» moment. */
  isPartial: boolean;
  /** A reminder time has passed today and the amount is not done yet. */
  isDue: boolean;
  nextSlot: string | null;
  canIncrease: boolean;
  /** The single ladder step an increase would reach (capped at the ceiling). */
  increaseTo: number | null;
  /** First day an increase can be considered (hold period). */
  holdUntil: LocalDate;
  isRelapse: boolean;
  relapseTo: number | null;
  band: AdherenceBand;
  ageDays: number;
  /** Days with anything logged in the last {@link MONTH_DAYS}. */
  doneDaysInMonth: number;
}

export function planToday(plan: Plan, today: LocalDate, nowMinutes: number): PlanToday {
  const required = requiredOn(plan, today);
  const done = plan.log[today] ?? 0;
  const remaining = Math.max(0, required - done);
  const passed = plan.slots.filter((slot) => timeToMinutes(slot) <= nowMinutes);
  const upcoming = plan.slots.filter((slot) => timeToMinutes(slot) > nowMinutes);
  const ageDays = diffDays(plan.createdOn, today);
  const monthStart = addDays(today, -(MONTH_DAYS - 1));
  const ratio = adherence(plan, monthStart, today);
  const step = nextStep(plan.amount);
  const increaseTo = step === null ? null : plan.ceiling !== undefined ? Math.min(step, plan.ceiling) : step;
  const isRelapse = status(plan, today) === 'relapse';
  const base = baseAmount(plan);
  const suggestion = relapseSuggestion(base);
  return {
    required,
    done,
    remaining,
    isComplete: remaining === 0,
    isPartial: done > 0 && remaining > 0,
    isDue: remaining > 0 && passed.length > 0,
    nextSlot: upcoming[0] ?? null,
    canIncrease: canIncrease(plan, today),
    increaseTo,
    holdUntil: addDays(plan.amountChangedOn, HOLD_DAYS),
    isRelapse,
    relapseTo: isRelapse && suggestion < base ? suggestion : null,
    band: adherenceBand(ratio, ageDays),
    ageDays,
    doneDaysInMonth: eachDay(maxOf(monthStart, plan.createdOn), today).filter((d) => (plan.log[d] ?? 0) > 0).length,
  };
}

function maxOf(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

/** The last {@link PROGRESS_DAYS} days for «وين وصلت»: done or not, never "missed". */
export function progressDays(plan: Plan, today: LocalDate): { date: LocalDate; done: boolean; beforeStart: boolean }[] {
  return eachDay(addDays(today, -(PROGRESS_DAYS - 1)), today).map((date) => ({
    date,
    done: (plan.log[date] ?? 0) > 0,
    beforeStart: date < plan.createdOn,
  }));
}

/** Today's last day of Ramadan when today is in Ramadan (Umm al-Qura + the user's offset), else null. */
export function ramadanEnd(today: LocalDate, hijriOffset: number): LocalDate | null {
  if (!isHijriSupported() || toHijri(today, hijriOffset).month !== 9) return null;
  const days = occurrences({ kind: 'hijriWindow', month: 9, fromDay: 1, toDay: 30 }, today, addDays(today, 31), { hijriOffset });
  let end = today;
  for (const day of days) {
    if (diffDays(end, day) > 1) break;
    end = day;
  }
  return end;
}

const DAILY: Rule = { kind: 'daily' };

/**
 * Reminder events for the next {@link REMINDER_DAYS} days: every slot of every plan on the days its habit
 * rule fires (daily when the catalog is not loaded). Titles are the habit titles (good deeds, not private).
 */
export function planReminderEvents(
  plans: readonly Plan[],
  habits: ReadonlyMap<string, PracticeHabit>,
  today: LocalDate,
  lang: 'ar' | 'en',
  hijriOffset: number,
): IcsEvent[] {
  const to = addDays(today, REMINDER_DAYS - 1);
  const events: IcsEvent[] = [];
  for (const plan of plans) {
    const habit = habitOf(plan, habits);
    const rule = habit?.defaultRule ?? DAILY;
    if (rule.kind.startsWith('hijri') && !isHijriSupported()) continue;
    const title = lang === 'en' && habit ? habit.titleEn : plan.title;
    for (const slot of plan.slots) {
      events.push(
        ...occurrencesToEvents(
          rule,
          today,
          to,
          {
            uidPrefix: `plan-${plan.id}-${slot.replace(':', '')}`,
            title,
            time: slot,
            durationMinutes: plan.unit === 'minutes' ? Math.max(5, Math.round(plan.amount)) : 10,
            alarmMinutesBefore: 0,
          },
          { hijriOffset },
        ),
      );
    }
  }
  return events.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
}

export function planRemindersIcs(events: IcsEvent[], calendarName: string, now?: Date): string {
  return buildIcs({ calendarName, events, now });
}

/** «يومي ثقيل» for every plan at once (`on`), or back to the plans' own amounts. */
export function setEbbForAll(store: Store, on: boolean, today: LocalDate): Store {
  return store.plans.reduce((next, plan) => updatePlan(next, plan.id, (p) => (on ? startEbb(p, today) : endEbb(p))), store);
}
