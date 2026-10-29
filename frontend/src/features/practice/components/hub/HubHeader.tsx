'use client';

import { CalendarDays } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { weekday } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGregorian } from '@/lib/practice/format';
import { useHijriLabel } from '../../hooks/useHijriLabel';
import { AddMenu } from './AddMenu';

interface HubHeaderProps {
  /** The selected day, or null until the device clock and store are read. */
  date: string | null;
  hijriOffset: number;
}

/** «عاداتي», the selected day in Hijri (with the user's offset) and Gregorian, the calendar and «أضف». */
export function HubHeader({ date, hijriOffset }: HubHeaderProps) {
  const t = useTranslations('practice.hub');
  const tDays = useTranslations('practice.weekdays');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const hijriLabel = useHijriLabel();
  const hijri = date ? hijriLabel(date, hijriOffset) : null;

  return (
    <header className="page-heading flex !max-w-none flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col">
        <h1 id="page-title" tabIndex={-1}>
          {t('title')}
        </h1>
        {date ? (
          <p className="text-base leading-8 sm:text-lg">
            {hijri ? (
              <>
                <span>{t('dateLine', { weekday: tDays(`d${weekday(date)}`), hijri })}</span>
                <span className="text-muted-foreground"> · {formatGregorian(date, locale)}</span>
              </>
            ) : (
              formatGregorian(date, locale, true)
            )}
          </p>
        ) : (
          <Skeleton className="mt-2 h-6 w-64 max-w-full" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link href="/calendar" className="outline-button button-wrap !min-h-11">
          <CalendarDays aria-hidden />
          {t('calendar')}
        </Link>
        <AddMenu />
      </div>
    </header>
  );
}
