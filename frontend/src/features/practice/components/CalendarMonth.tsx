'use client';

import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { occasionsByDate } from '@/lib/practice/calendar';
import { formatGregorian } from '@/lib/practice/format';
import { monthOf } from '@/lib/practice/hub';
import type { OccasionDate } from '@/lib/types/practice';
import { useDaySelection } from '../hooks/useDaySelection';
import { useHijriLabel } from '../hooks/useHijriLabel';
import { MonthGrid } from './hub/MonthGrid';

interface CalendarMonthProps {
  entries: readonly OccasionDate[];
  today: string;
  hijriOffset: number;
  /** The loaded range: the grid pages from this month to the month of `to`. */
  to: string;
}

/** «التقويم» as a month: Hijri and Gregorian days, occasions marked, and the selected day's occasions beside it. */
export function CalendarMonth({ entries, today, hijriOffset, to }: CalendarMonthProps) {
  const t = useTranslations('calendarPage.month');
  const tGrid = useTranslations('practice.monthGrid');
  const selection = useDaySelection(today);
  const byDate = useMemo(() => occasionsByDate(entries), [entries]);
  if (!selection) return null;

  return (
    <section aria-labelledby="calendar-month-title" className="flex flex-col gap-4">
      <h2 id="calendar-month-title" className="text-2xl font-medium">
        {t('title')}
      </h2>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="flex flex-col gap-3">
          <MonthGrid
            month={selection.month}
            today={today}
            selected={selection.selected}
            hijriOffset={hijriOffset}
            occasions={byDate}
            showHijriDay
            minMonth={monthOf(today)}
            maxMonth={monthOf(to)}
            onSelect={selection.select}
            onMonthChange={selection.showMonth}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-intent-good-deed" />
            {tGrid('occasion')}
          </p>
        </div>
        <SelectedDay date={selection.selected} occasions={byDate.get(selection.selected) ?? []} hijriOffset={hijriOffset} />
      </div>
    </section>
  );
}

interface SelectedDayProps {
  date: string;
  occasions: readonly OccasionDate[];
  hijriOffset: number;
}

function SelectedDay({ date, occasions, hijriOffset }: SelectedDayProps) {
  const t = useTranslations('calendarPage');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const hijri = useHijriLabel()(date, hijriOffset);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-live="polite">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-lg font-medium">{formatGregorian(date, locale, true)}</h3>
        {hijri ? <p className="text-sm text-muted-foreground">{hijri}</p> : null}
      </div>
      {occasions.length === 0 ? (
        <p className="text-muted-foreground">{t('month.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {occasions.map((occasion) => (
            <li key={occasion.key} className="flex flex-col gap-0.5">
              <Link href={`/good-deeds/${occasion.deed}`} className="text-link self-start text-base">
                <CalendarDays aria-hidden />
                <span>{locale === 'en' ? occasion.titleEn : occasion.titleAr}</span>
                <DirectionalArrow />
              </Link>
              {occasion.basis === 'organizational' ? (
                <p className="text-sm text-muted-foreground">{t('organizational')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
