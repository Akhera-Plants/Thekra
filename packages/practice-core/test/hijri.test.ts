import { describe, expect, it } from 'vitest';
import { formatHijriAr, hijriMonthNameAr, isHijriSupported, toHijri } from '../src/index.js';

describe('hijri (Intl islamic-umalqura)', () => {
  it('is supported on this runtime', () => {
    expect(isHijriSupported()).toBe(true);
  });

  it('converts the roadmap reference date: 2026-10-28 = 17 Jumada al-Ula 1448', () => {
    expect(toHijri('2026-10-28')).toEqual({ year: 1448, month: 5, day: 17 });
  });

  it('places 1 Ramadan 1447 on 2026-02-18 (what Intl Umm al-Qura returns)', () => {
    expect(toHijri('2026-02-17')).toEqual({ year: 1447, month: 8, day: 29 });
    expect(toHijri('2026-02-18')).toEqual({ year: 1447, month: 9, day: 1 });
    expect(toHijri('2026-03-19')).toEqual({ year: 1447, month: 9, day: 30 });
    expect(toHijri('2026-03-20')).toEqual({ year: 1447, month: 10, day: 1 });
  });

  it('knows Arafah 1447 and the new year 1448', () => {
    expect(toHijri('2026-05-26')).toEqual({ year: 1447, month: 12, day: 9 });
    expect(toHijri('2026-06-16')).toEqual({ year: 1448, month: 1, day: 1 });
    expect(toHijri('2026-06-25')).toEqual({ year: 1448, month: 1, day: 10 });
  });

  it('applies the user offset by shifting the Gregorian date', () => {
    // −1: the local month starts a day later than Umm al-Qura.
    expect(toHijri('2026-02-18', -1)).toEqual({ year: 1447, month: 8, day: 29 });
    expect(toHijri('2026-02-19', -1)).toEqual({ year: 1447, month: 9, day: 1 });
    // +1: a day earlier.
    expect(toHijri('2026-02-17', 1)).toEqual({ year: 1447, month: 9, day: 1 });
    expect(toHijri('2026-10-28', 2)).toEqual({ year: 1448, month: 5, day: 19 });
    expect(() => toHijri('2026-10-28', 3)).toThrow(RangeError);
    expect(() => toHijri('2026-10-28', 0.5)).toThrow(RangeError);
  });

  it('rejects invalid dates', () => {
    expect(() => toHijri('2026-02-30')).toThrow(RangeError);
  });

  it('names months in Arabic', () => {
    expect(hijriMonthNameAr(1)).toBe('محرم');
    expect(hijriMonthNameAr(5)).toBe('جمادى الأولى');
    expect(hijriMonthNameAr(9)).toBe('رمضان');
    expect(hijriMonthNameAr(12)).toBe('ذو الحجة');
    expect(() => hijriMonthNameAr(0)).toThrow(RangeError);
    expect(() => hijriMonthNameAr(13)).toThrow(RangeError);
  });

  it('formats in Arabic with Western digits', () => {
    expect(formatHijriAr('2026-10-28')).toBe('17 جمادى الأولى 1448 هـ');
    expect(formatHijriAr('2026-02-18')).toBe('1 رمضان 1447 هـ');
    expect(formatHijriAr('2026-10-28')).not.toMatch(/[٠-٩]/);
  });
});
