import { useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatHijriAr, hijriMonthNameAr, isHijriSupported, toHijri, type HijriDate } from '@thekra/practice-core';

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
