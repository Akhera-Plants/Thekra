import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDates,
  diffDays,
  eachDay,
  fromDayNumber,
  isValidDate,
  isValidTime,
  maxDate,
  minDate,
  timeToMinutes,
  toDayNumber,
  todayFrom,
  weekday,
} from '../src/index.js';

describe('dates', () => {
  it('validates YYYY-MM-DD strictly', () => {
    expect(isValidDate('2026-10-28')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-1-01')).toBe(false);
    expect(isValidDate('0099-01-01')).toBe(false);
    expect(isValidDate(20261028)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });

  it('validates HH:MM', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:30')).toBe(false);
    expect(timeToMinutes('05:30')).toBe(330);
    expect(() => timeToMinutes('5:30')).toThrow(RangeError);
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-10-28', 4)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    // A DST change (late March / late October in many zones) never shifts a day.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 3)).toBe('2026-10-27');
    expect(() => addDays('2026-10-28', 1.5)).toThrow(RangeError);
  });

  it('computes weekday (0 = Sunday)', () => {
    expect(weekday('2026-10-28')).toBe(3); // Wednesday
    expect(weekday('2026-11-01')).toBe(0);
    expect(weekday('1970-01-01')).toBe(4);
    expect(weekday('1969-12-28')).toBe(0);
  });

  it('compares and diffs', () => {
    expect(compareDates('2026-10-28', '2026-11-01')).toBe(-1);
    expect(compareDates('2026-11-01', '2026-10-28')).toBe(1);
    expect(compareDates('2026-10-28', '2026-10-28')).toBe(0);
    expect(() => compareDates('2026-10-28', 'x')).toThrow(RangeError);
    expect(diffDays('2026-10-28', '2026-11-27')).toBe(30);
    expect(diffDays('2026-11-27', '2026-10-28')).toBe(-30);
    expect(maxDate('2026-10-28', '2026-10-29')).toBe('2026-10-29');
    expect(minDate('2026-10-28', '2026-10-29')).toBe('2026-10-28');
  });

  it('round-trips day numbers and lists days', () => {
    expect(fromDayNumber(toDayNumber('2026-10-28'))).toBe('2026-10-28');
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(eachDay('2026-11-02', '2026-10-30')).toEqual([]);
  });

  it('takes today from the device local fields of a Date', () => {
    expect(todayFrom(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28');
    expect(todayFrom(new Date(2026, 9, 29, 0, 1))).toBe('2026-10-29');
    expect(() => todayFrom(new Date('nope'))).toThrow(RangeError);
  });
});
