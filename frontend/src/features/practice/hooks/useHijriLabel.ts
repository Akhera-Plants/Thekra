import { useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatHijriAr, hijriMonthNameAr, isHijriSupported, toHijri, type HijriDate } from '@thekra/practice-core';
import type { HijriMonthSpan } from '@/lib/practice/hub';

/**
 * A Hijri date in the page language: Arabic via practice-core («17 جمادى الأولى 1448 هـ»), English with
 * transliterated month names from the messages. Null when the runtime has no Umm al-Qura calendar.
 */
export function useHijriLabel() {
  const locale = useLocale();
  const t = useTranslations('calendarPage.hijri');
  return useCallback(
    (value: string | HijriDate | null, offset = 0): string | null => {
      if (value === null) return null;
      if (typeof value === 'string' && !isHijriSupported()) return null;
      if (locale !== 'en') {
        if (typeof value === 'string') return formatHijriAr(value, offset);
        return `${value.day} ${hijriMonthNameAr(value.month)} ${value.year} هـ`;
      }
      const h = typeof value === 'string' ? toHijri(value, offset) : value;
      return t('date', { day: String(h.day), month: t(`m${h.month}`), year: String(h.year) });
    },
    [locale, t],
  );
}

/**
 * The Hijri month(s) a Gregorian month spans, in the page language: «ربيع الآخر – جمادى الأولى 1448 هـ». Null when the
 * runtime has no Umm al-Qura calendar.
 */
export function useHijriMonthLabel() {
  const t = useTranslations('calendarPage.hijri');
  return useCallback(
    (span: HijriMonthSpan | null): string | null => {
      if (!span) return null;
      const { from, to } = span;
      if (from.month === to.month && from.year === to.year) {
        return t('monthOne', { month: t(`m${from.month}`), year: String(from.year) });
      }
      if (from.year === to.year) {
        return t('monthTwo', { from: t(`m${from.month}`), to: t(`m${to.month}`), year: String(to.year) });
      }
      return t('monthTwoYears', {
        from: t(`m${from.month}`),
        fromYear: String(from.year),
        to: t(`m${to.month}`),
        toYear: String(to.year),
      });
    },
    [t],
  );
}
