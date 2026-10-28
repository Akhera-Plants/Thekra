import { describe, expect, it } from 'vitest';
import { isDue, nextOccurrences, occurrences, toHijri, validateRule, type Rule } from '../src/index.js';

describe('validateRule', () => {
  it('accepts every valid kind', () => {
    const good: Rule[] = [
      { kind: 'daily' },
      { kind: 'weekdays', days: [1, 4] },
      { kind: 'everyNDays', n: 3, anchor: '2026-10-28' },
      { kind: 'everyNWeeks', n: 2, weekday: 5, anchor: '2026-10-28' },
      { kind: 'monthlyDay', day: 28 },
      { kind: 'hijriMonthDays', days: [13, 14, 15] },
      { kind: 'hijriYearly', month: 12, day: 9 },
      { kind: 'hijriWindow', month: 10, fromDay: 2, toDay: 30 },
    ];
    for (const r of good) expect(validateRule(r)).toBeNull();
  });

  it('rejects malformed rules with a message', () => {
    const bad: unknown[] = [
      null,
      'daily',
      { kind: 'monthly' },
      { kind: 'weekdays', days: [] },
      { kind: 'weekdays', days: [7] },
      { kind: 'weekdays', days: [1, 1] },
      { kind: 'everyNDays', n: 0, anchor: '2026-10-28' },
      { kind: 'everyNDays', n: 2.5, anchor: '2026-10-28' },
      { kind: 'everyNDays', n: 2, anchor: '28-10-2026' },
      { kind: 'everyNWeeks', n: 1, weekday: 7, anchor: '2026-10-28' },
      { kind: 'monthlyDay', day: 29 },
      { kind: 'monthlyDay', day: 0 },
      { kind: 'hijriMonthDays', days: [31] },
      { kind: 'hijriYearly', month: 13, day: 1 },
      { kind: 'hijriWindow', month: 10, fromDay: 10, toDay: 2 },
    ];
    for (const r of bad) expect(typeof validateRule(r)).toBe('string');
  });
});

describe('occurrences (Gregorian kinds)', () => {
  it('daily: inclusive and sorted', () => {
    expect(occurrences({ kind: 'daily' }, '2026-10-28', '2026-10-30')).toEqual(['2026-10-28', '2026-10-29', '2026-10-30']);
    expect(occurrences({ kind: 'daily' }, '2026-10-30', '2026-10-28')).toEqual([]);
  });

  it('weekdays: Monday and Thursday', () => {
    expect(occurrences({ kind: 'weekdays', days: [4, 1] }, '2026-10-28', '2026-11-09')).toEqual([
      '2026-10-29',
      '2026-11-02',
      '2026-11-05',
      '2026-11-09',
    ]);
  });

  it('everyNDays: starts at the anchor, nothing before it', () => {
    expect(occurrences({ kind: 'everyNDays', n: 3, anchor: '2026-10-28' }, '2026-10-20', '2026-11-05')).toEqual([
      '2026-10-28',
      '2026-10-31',
      '2026-11-03',
    ]);
  });

  it('everyNWeeks: first matching weekday on or after the anchor, then every n weeks', () => {
    const rule: Rule = { kind: 'everyNWeeks', n: 2, weekday: 5, anchor: '2026-10-28' };
    expect(occurrences(rule, '2026-10-01', '2026-11-30')).toEqual(['2026-10-30', '2026-11-13', '2026-11-27']);
    expect(occurrences({ kind: 'everyNWeeks', n: 1, weekday: 3, anchor: '2026-10-28' }, '2026-10-28', '2026-11-11')).toEqual([
      '2026-10-28',
      '2026-11-04',
      '2026-11-11',
    ]);
  });

  it('monthlyDay: exists in February', () => {
    expect(occurrences({ kind: 'monthlyDay', day: 28 }, '2027-01-01', '2027-03-31')).toEqual([
      '2027-01-28',
      '2027-02-28',
      '2027-03-28',
    ]);
  });

  it('throws on invalid rule, date or a span that is too long', () => {
    expect(() => occurrences({ kind: 'monthlyDay', day: 31 }, '2026-01-01', '2026-02-01')).toThrow(RangeError);
    expect(() => occurrences({ kind: 'daily' }, '2026-01-01', 'soon')).toThrow(RangeError);
    expect(() => occurrences({ kind: 'daily' }, '2026-01-01', '2040-01-01')).toThrow(RangeError);
  });
});

describe('occurrences (Hijri kinds)', () => {
  it('white days 13–15 of Jumada al-Ula 1448', () => {
    expect(occurrences({ kind: 'hijriMonthDays', days: [13, 14, 15] }, '2026-10-20', '2026-10-31')).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
  });

  it('white days over a year: three per Hijri month, every one on 13/14/15', () => {
    const dates = occurrences({ kind: 'hijriMonthDays', days: [13, 14, 15] }, '2026-06-16', '2027-06-04');
    expect(dates.length).toBe(36);
    for (const d of dates) expect([13, 14, 15]).toContain(toHijri(d).day);
  });

  it('respects the user offset', () => {
    // Local month starts a day later → every white day moves one Gregorian day later.
    expect(occurrences({ kind: 'hijriMonthDays', days: [13, 14, 15] }, '2026-10-20', '2026-10-31', { hijriOffset: -1 })).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
    expect(() => occurrences({ kind: 'daily' }, '2026-10-20', '2026-10-31', { hijriOffset: 5 })).toThrow(RangeError);
  });

  it('hijriYearly: Arafah (9 Dhu al-Hijja) and Ashura (10 Muharram)', () => {
    expect(nextOccurrences({ kind: 'hijriYearly', month: 12, day: 9 }, '2026-01-01', 2)).toEqual(['2026-05-26', '2027-05-15']);
    expect(nextOccurrences({ kind: 'hijriYearly', month: 1, day: 10 }, '2026-01-01', 1)).toEqual(['2026-06-25']);
  });

  it('hijriWindow: Shawwal 2–30 of 1447 (a 29-day Shawwal)', () => {
    const dates = occurrences({ kind: 'hijriWindow', month: 10, fromDay: 2, toDay: 30 }, '2026-03-01', '2026-05-01');
    expect(dates[0]).toBe('2026-03-21');
    expect(dates[dates.length - 1]).toBe('2026-04-17');
    expect(dates.length).toBe(28);
  });
});

describe('nextOccurrences / isDue', () => {
  it('returns the next n dates on or after from', () => {
    expect(nextOccurrences({ kind: 'weekdays', days: [5] }, '2026-10-30', 3)).toEqual(['2026-10-30', '2026-11-06', '2026-11-13']);
    expect(nextOccurrences({ kind: 'daily' }, '2026-10-30', 0)).toEqual([]);
    expect(() => nextOccurrences({ kind: 'daily' }, '2026-10-30', -1)).toThrow(RangeError);
  });

  it('isDue matches occurrences', () => {
    expect(isDue({ kind: 'weekdays', days: [3] }, '2026-10-28')).toBe(true);
    expect(isDue({ kind: 'weekdays', days: [4] }, '2026-10-28')).toBe(false);
    expect(isDue({ kind: 'hijriYearly', month: 9, day: 1 }, '2026-02-18')).toBe(true);
    expect(isDue({ kind: 'hijriYearly', month: 9, day: 1 }, '2026-02-18', { hijriOffset: -1 })).toBe(false);
    expect(() => isDue({ kind: 'daily' }, '2026-02-30')).toThrow(RangeError);
  });
});
