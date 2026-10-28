import { addDays, createPlan, logDone, startEbb, toHijri, weekday, type Plan, type Rule } from '@thekra/practice-core';
import { describe, expect, it } from 'vitest';
import {
  isReminderDay,
  localInstant,
  parseAlarmName,
  remainingOn,
  reminderAlarmName,
  shouldNotify,
  snoozeAlarmName,
  snoozeUntil,
  upcomingReminders,
  type ScheduleInput,
} from '../src/scheduler.js';

// 2026-10-28 is a Wednesday (weekday 3).
const TODAY = '2026-10-28';
const at = (date: string, time: string) => new Date(localInstant(date, time));

function plan(id: string, slots: string[], extra: Partial<Plan> = {}): Plan {
  return {
    ...createPlan({ id, deedSlug: 'quran', title: id, unit: 'minutes', amount: 5, activeDaysPerWeek: 4, slots, createdOn: '2026-10-01' }),
    ...extra,
  };
}

function input(plans: Plan[], now: Date, extra: Partial<ScheduleInput> = {}): ScheduleInput {
  return { plans, rules: {}, quietDays: [], hijriOffset: 0, now, ...extra };
}

describe('upcomingReminders', () => {
  it('gives the next slot today, later today, then tomorrow', () => {
    const p = plan('quran-wird', ['21:00', '09:30']);
    expect(upcomingReminders(input([p], at(TODAY, '08:00')))).toEqual([
      { planId: 'quran-wird', date: TODAY, time: '09:30', when: localInstant(TODAY, '09:30') },
    ]);
    expect(upcomingReminders(input([p], at(TODAY, '10:00')))[0]).toMatchObject({ date: TODAY, time: '21:00' });
    expect(upcomingReminders(input([p], at(TODAY, '21:00')))[0]).toMatchObject({ date: '2026-10-29', time: '09:30' });
  });

  it('only returns instants strictly after now', () => {
    const p = plan('a', ['09:30']);
    const now = at(TODAY, '09:30');
    for (const r of upcomingReminders(input([p], now), 5)) expect(r.when).toBeGreaterThan(now.getTime());
  });

  it("skips today's remaining slots once today's amount is logged, not before", () => {
    const partial = logDone(plan('a', ['09:30', '21:00']), TODAY, 3);
    expect(upcomingReminders(input([partial], at(TODAY, '10:00')))[0]).toMatchObject({ date: TODAY, time: '21:00' });
    const full = logDone(partial, TODAY, 2);
    expect(upcomingReminders(input([full], at(TODAY, '10:00')))[0]).toMatchObject({ date: '2026-10-29', time: '09:30' });
  });

  it('never doubles a missed day: the amount asked for today ignores yesterday', () => {
    const p = plan('a', ['09:30']);
    expect(p.log['2026-10-27']).toBeUndefined();
    expect(remainingOn(p, TODAY)).toBe(5);
  });

  it('an ebb asks for the token amount, so logging 2 completes the day', () => {
    const p = logDone(startEbb(plan('a', ['09:30', '21:00']), '2026-10-27'), TODAY, 2);
    expect(remainingOn(p, TODAY)).toBe(0);
    expect(upcomingReminders(input([p], at(TODAY, '10:00')))[0]?.date).toBe('2026-10-29');
  });

  it('skips quiet weekdays', () => {
    const p = plan('a', ['09:30']);
    // Thursday (4) and Friday (5) are quiet: the next reminder after Wednesday evening is Saturday.
    const r = upcomingReminders(input([p], at(TODAY, '20:00'), { quietDays: [4, 5] }))[0];
    expect(r?.date).toBe('2026-10-31');
    expect(weekday(r?.date as string)).toBe(6);
  });

  it('follows the plan rule (weekdays: Friday only)', () => {
    const p = plan('qiyam-last-third', ['04:00']);
    const rules: Record<string, Rule> = { 'qiyam-last-third': { kind: 'weekdays', days: [5] } };
    const list = upcomingReminders(input([p], at(TODAY, '08:00'), { rules }), 3);
    expect(list.map((r) => r.date)).toEqual(['2026-10-30', '2026-11-06', '2026-11-13']);
  });

  it('applies the Hijri offset to Hijri rules', () => {
    const p = plan('a', ['08:00']);
    const rules: Record<string, Rule> = { a: { kind: 'hijriMonthDays', days: [13] } };
    const base = upcomingReminders(input([p], at(TODAY, '09:00'), { rules }))[0];
    const shifted = upcomingReminders(input([p], at(TODAY, '09:00'), { rules, hijriOffset: 1 }))[0];
    expect(toHijri(base?.date as string, 0).day).toBe(13);
    expect(toHijri(shifted?.date as string, 1).day).toBe(13);
    expect(shifted?.date).toBe(addDays(base?.date as string, -1));
  });

  it('returns several plans sorted by time, at most perPlan each', () => {
    const a = plan('a', ['21:00', '09:30']);
    const b = plan('b', ['12:00']);
    const list = upcomingReminders(input([a, b], at(TODAY, '08:00')), 2);
    expect(list.map((r) => `${r.planId}@${r.date} ${r.time}`)).toEqual([
      `a@${TODAY} 09:30`,
      `b@${TODAY} 12:00`,
      `a@${TODAY} 21:00`,
      'b@2026-10-29 12:00',
    ]);
  });

  it('returns nothing when every rule day is quiet', () => {
    const p = plan('a', ['09:30']);
    expect(upcomingReminders(input([p], at(TODAY, '08:00'), { quietDays: [0, 1, 2, 3, 4, 5, 6] }))).toEqual([]);
  });

  it('reports reminder days', () => {
    const friday: Rule = { kind: 'weekdays', days: [5] };
    expect(isReminderDay(friday, [], '2026-10-30', 0)).toBe(true);
    expect(isReminderDay(friday, [5], '2026-10-30', 0)).toBe(false);
    expect(isReminderDay(friday, [], TODAY, 0)).toBe(false);
  });
});

describe('alarms', () => {
  it('round-trips alarm names and rejects anything else', () => {
    const name = reminderAlarmName({ planId: 'quran-wird', date: TODAY, time: '09:30' });
    expect(parseAlarmName(name)).toEqual({ kind: 'remind', planId: 'quran-wird', date: TODAY, time: '09:30' });
    expect(parseAlarmName(snoozeAlarmName('duha', TODAY))).toEqual({ kind: 'snooze', planId: 'duha', date: TODAY });
    for (const bad of ['refresh', 'remind|a|2026-13-01|09:30', 'remind|a|2026-10-28', 'snooze||2026-10-28', 'x|a|b|c']) {
      expect(parseAlarmName(bad)).toBeNull();
    }
  });

  it('snoozes for 30 minutes', () => {
    const now = at(TODAY, '09:30');
    expect(snoozeUntil(now) - now.getTime()).toBe(30 * 60 * 1000);
  });

  it('shows a fired reminder only on its own day, for an existing plan, while something is left', () => {
    const p = plan('a', ['09:30']);
    expect(shouldNotify(p, TODAY, at(TODAY, '09:31'))).toBe(true);
    expect(shouldNotify(p, '2026-10-27', at(TODAY, '09:31'))).toBe(false);
    expect(shouldNotify(undefined, TODAY, at(TODAY, '09:31'))).toBe(false);
    expect(shouldNotify(logDone(p, TODAY, 5), TODAY, at(TODAY, '09:31'))).toBe(false);
  });
});
