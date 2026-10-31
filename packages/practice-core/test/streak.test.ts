import { describe, expect, it } from 'vitest';
import {
  createPlan,
  currentStreak,
  emptyStore,
  logDone,
  longestStreak,
  startEbb,
  streakDay,
  upsertPlan,
  type Plan,
  type Rule,
  type Store,
} from '../src/index.js';

const T = '2026-10-28T10:00:00.000Z';
// 2026-10-26 is a Monday; 2026-10-31 a Saturday.
const plan = (id: string, createdOn = '2026-10-20', rule?: Rule): Plan => ({
  ...createPlan({ id, deedSlug: 'duha', title: id, unit: 'count', amount: 2, activeDaysPerWeek: 4, slots: ['09:30'], createdOn }, T),
  ...(rule ? { rule } : {}),
});

function storeOf(...plans: Plan[]): Store {
  return plans.reduce((s, p) => upsertPlan(s, p, T), emptyStore());
}

const logOn = (p: Plan, ...dates: string[]) => dates.reduce((acc, d) => logDone(acc, d, 1), p);

describe('streakDay', () => {
  it('is complete when every plan asked that day has any amount, incomplete otherwise, skipped when nothing is asked', () => {
    const a = logOn(plan('a'), '2026-10-28');
    const b = plan('b');
    expect(streakDay(storeOf(a), '2026-10-28')).toBe('complete');
    expect(streakDay(storeOf(a, b), '2026-10-28')).toBe('incomplete');
    expect(streakDay(storeOf(a), '2026-10-19')).toBe('skipped'); // before the plan existed
  });

  it('on «يومي ثقيل» anything logged completes the day', () => {
    const a = logOn(startEbb(plan('a'), '2026-10-28', T), '2026-10-28');
    const b = plan('b');
    expect(streakDay(storeOf(a, b), '2026-10-28')).toBe('complete');
    expect(streakDay(storeOf(startEbb(plan('a'), '2026-10-28', T), b), '2026-10-28')).toBe('incomplete');
  });

  it('follows the catalog default rule for plans without their own', () => {
    const fast = { ...plan('fast'), habitKey: 'fast-mon-thu' };
    const defaultRuleOf = (p: Plan): Rule | undefined => (p.habitKey === 'fast-mon-thu' ? { kind: 'weekdays', days: [1, 4] } : undefined);
    expect(streakDay(storeOf(fast), '2026-10-27', { defaultRuleOf })).toBe('skipped'); // Tuesday
    expect(streakDay(storeOf(fast), '2026-10-27')).toBe('incomplete'); // without the rule it is daily
  });
});

describe('currentStreak', () => {
  it('counts complete days ending today when today is complete', () => {
    const a = logOn(plan('a'), '2026-10-26', '2026-10-27', '2026-10-28');
    expect(currentStreak(storeOf(a), '2026-10-28')).toBe(3);
  });

  it('an incomplete today does not break the run: it is the run that ended yesterday', () => {
    const a = logOn(plan('a'), '2026-10-26', '2026-10-27');
    expect(currentStreak(storeOf(a), '2026-10-28')).toBe(2);
  });

  it('an incomplete day before today ends the run', () => {
    const a = logOn(plan('a'), '2026-10-24', '2026-10-25', '2026-10-27', '2026-10-28');
    expect(currentStreak(storeOf(a), '2026-10-28')).toBe(2);
  });

  it('days that ask for nothing are skipped: neither break nor add', () => {
    // Mondays and Thursdays only: Mon 19 (before start), Thu 22, Mon 26, Thu 29.
    const monThu: Rule = { kind: 'weekdays', days: [1, 4] };
    const a = logOn(plan('a', '2026-10-20', monThu), '2026-10-22', '2026-10-26');
    expect(currentStreak(storeOf(a), '2026-10-28')).toBe(2);
    expect(currentStreak(storeOf(a), '2026-10-29')).toBe(2); // Thursday not done yet
    expect(currentStreak(storeOf(logDone(a, '2026-10-29', 1)), '2026-10-29')).toBe(3);
  });

  it('is 0 without plans or without any complete day', () => {
    expect(currentStreak(emptyStore(), '2026-10-28')).toBe(0);
    expect(currentStreak(storeOf(plan('a')), '2026-10-28')).toBe(0);
  });

  it('a new plan asked today and not done yet does not break the run of the older plan', () => {
    const a = logOn(plan('a'), '2026-10-26', '2026-10-27');
    const b = plan('b', '2026-10-28');
    expect(currentStreak(storeOf(a, b), '2026-10-28')).toBe(2);
  });
});

describe('longestStreak', () => {
  it('finds the longest run, and an incomplete today keeps the open run', () => {
    const a = logOn(plan('a'), '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-25', '2026-10-26');
    const s = storeOf(a);
    expect(longestStreak(s, '2026-10-28')).toBe(4);
    expect(longestStreak(s, '2026-10-27')).toBe(4);
    expect(currentStreak(s, '2026-10-27')).toBe(2);
    expect(longestStreak(emptyStore(), '2026-10-28')).toBe(0);
  });

  it('is never below the current streak', () => {
    const a = logOn(plan('a'), '2026-10-27', '2026-10-28');
    const s = storeOf(a);
    expect(longestStreak(s, '2026-10-28')).toBeGreaterThanOrEqual(currentStreak(s, '2026-10-28'));
  });
});
