import { addDays, createPlan, eachDay, isEbbOn, logDone, requiredOn, toHijri, weekday, type Plan, type Rule } from '@thekra/practice-core';
import { describe, expect, it } from 'vitest';
import { applyIncrease, effectivePlan, increaseSuggestion, monthlyBand, ramadanEnd, seasonAmount, setEbb, setSeason } from '../src/progress.js';

const TODAY = '2026-10-28';
const DAILY: Rule = { kind: 'daily' };
const FRIDAY: Rule = { kind: 'weekdays', days: [5] };

function plan(createdOn: string, activeDaysPerWeek = 4): Plan {
  return createPlan({ id: 'quran-wird', deedSlug: 'quran', title: 'ورد القرآن', unit: 'minutes', amount: 5, activeDaysPerWeek, slots: ['06:00'], createdOn });
}

function logDays(p: Plan, days: string[]): Plan {
  return days.reduce((acc, d) => logDone(acc, d, 1), p);
}

describe('monthly band', () => {
  it('has no band during the first week, even after a logged day', () => {
    expect(monthlyBand(plan(TODAY), DAILY, [], TODAY, 0)).toBeNull();
    expect(monthlyBand(logDone(plan(addDays(TODAY, -6)), TODAY, 1), DAILY, [], TODAY, 0)).toBeNull();
    expect(monthlyBand(logDone(plan(addDays(TODAY, -7)), TODAY, 1), DAILY, [], TODAY, 0)).not.toBeNull();
  });

  it('is excellent, good or gentle, never a failure word', () => {
    const p = plan('2026-08-01');
    const last28 = eachDay(addDays(TODAY, -28), addDays(TODAY, -1));
    expect(monthlyBand(logDays(p, last28.filter((d) => weekday(d) < 4)), DAILY, [], TODAY, 0)).toBe('excellent');
    expect(monthlyBand(logDays(p, last28.filter((d) => weekday(d) < 2)), DAILY, [], TODAY, 0)).toBe('good');
    expect(monthlyBand(p, DAILY, [], TODAY, 0)).toBe('gentle');
  });

  it('caps the target at the days the rule allows (Friday only: 4 Fridays of 4 is excellent)', () => {
    const p = plan('2026-08-01', 2);
    const fridays = eachDay(addDays(TODAY, -27), TODAY).filter((d) => weekday(d) === 5);
    expect(fridays).toHaveLength(4);
    expect(effectivePlan(p, FRIDAY, [], TODAY, 0).activeDaysPerWeek).toBe(1);
    expect(monthlyBand(logDays(p, fridays), FRIDAY, [], TODAY, 0)).toBe('excellent');
  });
});

describe('increase', () => {
  const steady = (createdOn: string) => logDays(plan(createdOn), eachDay(createdOn, addDays(TODAY, -1)));

  it('is offered only after the 28-day hold with steady practice, one ladder step', () => {
    expect(increaseSuggestion(steady('2026-10-10'), DAILY, [], TODAY, 0)).toBeNull();
    expect(increaseSuggestion(steady('2026-09-01'), DAILY, [], TODAY, 0)).toBe(7);
    expect(increaseSuggestion(plan('2026-09-01'), DAILY, [], TODAY, 0)).toBeNull();
  });

  it('applies one step and restarts the hold', () => {
    const up = applyIncrease(steady('2026-09-01'), DAILY, [], TODAY, 0);
    expect(up.amount).toBe(7);
    expect(up.activeDaysPerWeek).toBe(4);
    expect(increaseSuggestion(up, DAILY, [], TODAY, 0)).toBeNull();
  });

  it('is never offered during an ebb', () => {
    expect(increaseSuggestion(setEbb(steady('2026-09-01'), true, TODAY), DAILY, [], TODAY, 0)).toBeNull();
    expect(setEbb(setEbb(plan(TODAY), true, TODAY), false, TODAY).ebb).toBeUndefined();
  });
});

describe('heavy day («يومي ثقيل»)', () => {
  it('is on for its own day only and ends by itself', () => {
    const heavy = setEbb(plan('2026-09-01'), true, addDays(TODAY, -1));
    expect(isEbbOn(heavy, addDays(TODAY, -1))).toBe(true);
    expect(isEbbOn(heavy, TODAY)).toBe(false);
    expect(requiredOn(heavy, addDays(TODAY, -1))).toBe(2);
    expect(requiredOn(heavy, TODAY)).toBe(5);
  });

  it('does not block an increase the next day', () => {
    const steady = logDays(plan('2026-09-01'), eachDay('2026-09-01', addDays(TODAY, -1)));
    expect(increaseSuggestion(setEbb(steady, true, addDays(TODAY, -1)), DAILY, [], TODAY, 0)).toBe(7);
  });
});

describe('Ramadan season', () => {
  function firstRamadanDay(): string {
    let d = TODAY;
    while (toHijri(d, 0).month !== 9) d = addDays(d, 1);
    return d;
  }

  it('is only available in Ramadan and ends on its last day', () => {
    expect(ramadanEnd(TODAY, 0)).toBeNull();
    const start = firstRamadanDay();
    const end = ramadanEnd(start, 0) as string;
    expect(toHijri(end, 0).month).toBe(9);
    expect(toHijri(addDays(end, 1), 0).month).toBe(10);
  });

  it('raises one step and returns to the everyday amount without penalty', () => {
    const start = firstRamadanDay();
    const p = plan(addDays(start, -40));
    expect(seasonAmount(p)).toBe(7);
    const on = setSeason(p, true, start, 0);
    expect(on.amount).toBe(7);
    expect(on.amountChangedOn).toBe(p.amountChangedOn);
    const off = setSeason(on, false, addDays(start, 3), 0);
    expect(off.amount).toBe(5);
    expect(off.season).toBeUndefined();
    expect(() => setSeason(p, true, TODAY, 0)).toThrow();
  });
});
