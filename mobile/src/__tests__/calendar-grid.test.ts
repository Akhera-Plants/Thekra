/**
 * Week strip and month grid math, and the date labels of the «عاداتي» hub and the calendar page.
 */

import { isHijriSupported, weekday } from '@thekra/practice-core';
import {
  addMonths,
  dayTitle,
  firstWeekday,
  hijriMonthsTitle,
  monthEnd,
  monthStart,
  monthTitle,
  monthWeeks,
  shortDayTitle,
  weekDays,
  weekdayOrder,
  type DateNames,
} from '../lib/practice/calendar-grid';

const AR_WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const HIJRI = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const names: DateNames = {
  weekday: (d) => AR_WEEKDAYS[d]!,
  gregorianMonth: (m) => AR_MONTHS[m - 1]!,
  hijriMonth: (m) => HIJRI[m - 1]!,
};

describe('weeks', () => {
  it('starts on Saturday in Arabic and on Sunday in English', () => {
    expect(firstWeekday('ar')).toBe(6);
    expect(firstWeekday('en')).toBe(0);
    const ar = weekDays('2026-10-29', 6);
    expect(ar[0]).toBe('2026-10-24');
    expect(weekday(ar[0]!)).toBe(6);
    expect(ar).toHaveLength(7);
    expect(ar).toContain('2026-10-29');
    expect(weekDays('2026-10-29', 0)[0]).toBe('2026-10-25');
    expect(weekdayOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it('a week starting on its own first day stays put', () => {
    expect(weekDays('2026-10-24', 6)[0]).toBe('2026-10-24');
    expect(weekDays('2026-10-30', 6)[6]).toBe('2026-10-30');
  });
});

describe('months', () => {
  it('finds the first and last day and moves across years', () => {
    expect(monthStart('2026-10-29')).toBe('2026-10-01');
    expect(monthEnd('2026-10-29')).toBe('2026-10-31');
    expect(monthEnd('2028-02-10')).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
  });

  it('lays a month out in full weeks of 7, blanks outside the month', () => {
    const weeks = monthWeeks('2026-10-29', 6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const days = weeks.flat().filter((d): d is string => d !== null);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-10-01');
    // 1 October 2026 is a Thursday: the sixth cell of a Saturday-first week.
    expect(weeks[0]!.indexOf('2026-10-01')).toBe(5);
    expect(weeks[0]!.slice(0, 5)).toEqual([null, null, null, null, null]);
  });
});

describe('labels', () => {
  it('names the month and the day', () => {
    expect(monthTitle('2026-10-29', names)).toBe('أكتوبر 2026');
    expect(shortDayTitle('2026-10-29', names)).toBe('الخميس 29 أكتوبر');
  });

  const hijri = isHijriSupported() ? it : it.skip;

  hijri('shows the Hijri date (with the user offset) before the Gregorian one', () => {
    expect(dayTitle('2026-10-29', 0, names)).toBe('الخميس 18 جمادى الأولى 1448 · 29 أكتوبر');
    expect(dayTitle('2026-10-29', -1, names)).toBe('الخميس 17 جمادى الأولى 1448 · 29 أكتوبر');
  });

  hijri('lists the Hijri months a Gregorian month touches', () => {
    const title = hijriMonthsTitle('2026-10-29', 0, names, '، ');
    expect(title).toMatch(/1448$/);
    expect(title).toContain('جمادى الأولى');
    expect(title?.split('، ').length).toBeGreaterThanOrEqual(2);
  });
});
