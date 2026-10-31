'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { useHijriLabel } from '../../hooks/useHijriLabel';
import { AddMenu } from './AddMenu';
import { StreakFlame } from './StreakFlame';

interface WirdHeaderProps {
  /** Today, or null until the device clock and store are read. */
  date: string | null;
  hijriOffset: number;
  /** «إظهار التاريخ الهجري»: the Hijri date after the Gregorian one. Off by default. */
  showHijri: boolean;
  /** The current streak; null hides the chip (no habit yet). */
  streak: number | null;
  /** The longest run: with a current streak of 0 the chip says «ابدأ مداومة جديدة اليوم» instead of a 0. */
  longest?: number;
  /** Opens «أضف» at once (`?add=1`, from the home page's «ابدأ بغرسٍ صغير»). */
  addOpen?: boolean;
}

/**
 * The title block of «ورد اليوم»: the title and one date line (Gregorian; the Hijri date too when the setting is on),
 * and on the other side the streak chip (a gold flame and the number, never red) and «أضف», the page's one solid control.
 */
export function WirdHeader({ date, hijriOffset, showHijri, streak, longest = 0, addOpen = false }: WirdHeaderProps) {
  const t = useTranslations('practice.wird');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const hijriLabel = useHijriLabel();
  const hijri = date && showHijri ? hijriLabel(date, hijriOffset) : null;

  return (
    <header className="page-heading flex !max-w-none flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        {date ? (
          <p className="text-base leading-8 text-muted-foreground sm:text-lg">
            {formatGregorian(date, locale, true)}
            {hijri ? <> · {hijri}</> : null}
          </p>
        ) : (
          <Skeleton className="mt-2 h-6 w-64 max-w-full" />
        )}
      </div>
      <div className="flex items-center gap-2">
        {streak === 0 && longest > 0 ? (
          <p className="flex min-h-11 items-center gap-1.5 rounded-full bg-muted px-4 text-sm font-medium">
            <StreakFlame />
            {t('streakFresh', { n: formatDigits(longest) })}
          </p>
        ) : streak !== null ? (
          <p
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-muted px-4 text-base font-medium"
            aria-label={t('streakLabel', { count: streak, n: formatDigits(streak) })}
          >
            <StreakFlame />
            <span aria-hidden className="tabular-nums">
              {formatDigits(streak)}
            </span>
          </p>
        ) : null}
        <AddMenu defaultOpen={addOpen} />
      </div>
    </header>
  );
}
