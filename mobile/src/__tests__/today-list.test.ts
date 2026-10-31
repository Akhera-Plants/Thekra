/**
 * «عاداتي» today list and «يومي ثقيل» (pure helpers in plan-view.ts), the habit-reminder default (prefs.ts) and
 * the typed log amount (format.ts).
 * - The today list puts the habits asked for today first, with the same answer as the reminders (practice-core
 *   `isPlanDueOn`: plan rule, else catalog default, else daily).
 * - «يومي ثقيل» is one day: the switch lightens every plan for today and is off again by itself tomorrow.
 * - Habit reminders are on for a new install; a stored choice is kept; the first habit asks for the permission.
 */

import { createPlan, emptyStore, isEbbOn, requiredOn, startEbb, upsertPlan, type Plan, type Store } from '@thekra/practice-core';
import type { CatalogHabit } from '../lib/practice/catalog-types';
import { MAX_LOG_ENTRY, parseLogAmount } from '../lib/practice/format';
import { heavyDayOn, planView, setHeavyDay, splitByDue } from '../lib/practice/plan-view';
import { DEFAULT_PREFS, parsePrefs, shouldAskOnFirstHabit } from '../lib/practice/prefs';

const TODAY = '2026-10-28'; // a Wednesday
const TOMORROW = '2026-10-29'; // a Thursday
const NOW = '2026-10-28T08:00:00.000Z';

const quran: CatalogHabit = {
  key: 'quran-wird',
  titleAr: 'ورد القرآن',
  titleEn: 'Daily Quran reading',
  deed: 'quran',
  unit: 'minutes',
  unitLabelAr: 'دقيقة',
  unitLabelEn: 'minutes',
  start: { far: 2, near: 10 },
  defaultRule: { kind: 'daily' },
  defaultSlots: ['06:00', '21:00'],
  basis: 'organizational',
  evidence: [],
};

const duha: CatalogHabit = { ...quran, key: 'duha', titleAr: 'صلاة الضحى', defaultRule: { kind: 'weekdays', days: [1, 4] } };

function plan(id: string, habitKey: string, amount = 10, extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan(
      { id, habitKey, deedSlug: 'x', title: id, unit: 'minutes', amount, activeDaysPerWeek: 3, slots: ['21:00'], createdOn: '2026-10-01' },
      NOW,
    ),
    ...extra,
  };
}

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, NOW), emptyStore());
}

describe('today list: due habits first (isPlanDueOn)', () => {
  it('splits by the plan rule, else the catalog default, else daily, keeping store order', () => {
    const a = plan('a', 'quran-wird'); // catalog daily
    const b = plan('b', 'duha'); // catalog Mon/Thu: not today (Wednesday)
    const c = plan('c', 'duha', 10, { rule: { kind: 'weekdays', days: [3] } }); // own rule: Wednesdays
    const d = plan('d', 'unknown-habit'); // no rule, no catalog entry: daily
    const { due, notDue } = splitByDue([a, b, c, d], [quran, duha], TODAY, 0);
    expect(due.map((p) => p.id)).toEqual(['a', 'c', 'd']);
    expect(notDue.map((p) => p.id)).toEqual(['b']);
    expect(splitByDue([a, b, c, d], [quran, duha], TOMORROW, 0).due.map((p) => p.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('«يومي ثقيل» is one day', () => {
  it('turns on for every plan today and is off by itself tomorrow', () => {
    const s = setHeavyDay(storeOf(plan('a', 'quran-wird'), plan('b', 'duha')), true, TODAY, NOW);
    expect(heavyDayOn(s.plans, TODAY)).toBe(true);
    expect(s.plans.every((p) => requiredOn(p, TODAY) === 2)).toBe(true);
    expect(heavyDayOn(s.plans, TOMORROW)).toBe(false);
    expect(s.plans.every((p) => requiredOn(p, TOMORROW) === 10)).toBe(true);
    expect(planView(s.plans[0]!, TOMORROW).inEbb).toBe(false);
  });

  it('turning it on today replaces yesterday’s heavy day; off ends only today’s', () => {
    const yesterday = startEbb(plan('a', 'quran-wird'), '2026-10-27', NOW);
    let s = storeOf(yesterday, plan('b', 'duha'));
    expect(heavyDayOn(s.plans, TODAY)).toBe(false); // yesterday's ebb does not count today
    s = setHeavyDay(s, true, TODAY, NOW);
    expect(s.plans.every((p) => isEbbOn(p, TODAY))).toBe(true);
    s = setHeavyDay(s, false, TODAY, NOW);
    expect(s.plans.some((p) => isEbbOn(p, TODAY))).toBe(false);
    expect(heavyDayOn(s.plans, TODAY)).toBe(false);
  });

  it('stamps updatedAt (sync) only on the plans it changes, and is off with no plans', () => {
    const later = '2026-10-28T09:00:00.000Z';
    const s0 = storeOf(startEbb(plan('a', 'quran-wird'), TODAY, NOW), plan('b', 'duha'));
    const s1 = setHeavyDay(s0, true, TODAY, later);
    expect(s1.plans.find((p) => p.id === 'a')?.updatedAt).toBe(NOW); // already lightened today: untouched
    expect(s1.plans.find((p) => p.id === 'b')?.updatedAt).toBe(later);
    expect(heavyDayOn([], TODAY)).toBe(false);
  });

  it('a plan lightened for today keeps the switch on (the add flow lightens a new plan on a heavy day)', () => {
    const s = setHeavyDay(storeOf(plan('a', 'quran-wird')), true, TODAY, NOW);
    expect(heavyDayOn([...s.plans, plan('n', 'duha')], TODAY)).toBe(false);
    expect(heavyDayOn([...s.plans, startEbb(plan('n', 'duha'), TODAY, NOW)], TODAY)).toBe(true);
  });
});

describe('habit reminders default', () => {
  it('is on for a new install (no or unreadable prefs)', () => {
    expect(DEFAULT_PREFS.habitReminders).toBe(true);
    expect(parsePrefs(null).habitReminders).toBe(true);
    expect(parsePrefs('not json').habitReminders).toBe(true);
    expect(parsePrefs({ v: 1 }).habitReminders).toBe(true);
  });

  it('keeps a stored choice, on or off', () => {
    expect(parsePrefs({ v: 1, habitReminders: false }).habitReminders).toBe(false);
    expect(parsePrefs(JSON.stringify({ v: 1, habitReminders: false })).habitReminders).toBe(false);
    expect(parsePrefs({ v: 1, habitReminders: true }).habitReminders).toBe(true);
  });

  it('asks for the permission only when the first habit is added and reminders are on', () => {
    expect(shouldAskOnFirstHabit(0, { habitReminders: true })).toBe(true);
    expect(shouldAskOnFirstHabit(0, { habitReminders: false })).toBe(false);
    expect(shouldAskOnFirstHabit(2, { habitReminders: true })).toBe(false);
  });
});

describe('typed log amount', () => {
  it('accepts whole positive amounts, Arabic-Indic digits included', () => {
    expect(parseLogAmount('3')).toBe(3);
    expect(parseLogAmount(' ٣ ')).toBe(3);
    expect(parseLogAmount('١٢')).toBe(12);
    expect(parseLogAmount(String(MAX_LOG_ENTRY))).toBe(MAX_LOG_ENTRY);
  });

  it('rejects empty, zero, negative, fractions (the account stores whole amounts), text and too large', () => {
    for (const v of ['', '0', '-2', '1.5', '١٫٥', 'abc', '1e3', String(MAX_LOG_ENTRY + 1)]) expect(parseLogAmount(v)).toBeNull();
  });
});
