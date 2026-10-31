'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseDate, type DayPresence } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian, formatWeekdayShort } from '@/lib/practice/format';
import { presenceLevel, weekOf, weekStartFor } from '@/lib/practice/hub';
import { cn } from '@/lib/utils';
import { PresenceMark } from './PresenceMark';

interface WeekStripProps {
  selected: string;
  today: string;
  presence: ReadonlyMap<string, DayPresence>;
  onSelect: (date: string) => void;
  onShiftWeek: (weeks: number) => void;
}

/**
 * The week of the selected day, in reading order (Saturday first in Arabic): weekday, day number and a presence mark.
 * Any day can be opened; the day list decides what can be logged.
 */
export function WeekStrip({ selected, today, presence, onSelect, onShiftWeek }: WeekStripProps) {
  const t = useTranslations('practice.hub.week');
  const tGrid = useTranslations('practice.monthGrid');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const days = weekOf(selected, weekStartFor(locale));
  const range = t('range', {
    from: formatGregorian(days[0] as string, locale),
    to: formatGregorian(days[6] as string, locale),
  });

  return (
    <div role="group" aria-label={t('label')} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          tone="neutral"
          iconOnly
          icon={<ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />}
          aria-label={t('previous')}
          onClick={() => onShiftWeek(-1)}
        />
        <p className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{range}</span>
          {selected !== today ? (
            <Button variant="outline" tone="primary" size="sm" onClick={() => onSelect(today)}>
              {t('today')}
            </Button>
          ) : null}
        </p>
        <Button
          variant="ghost"
          tone="neutral"
          iconOnly
          icon={<ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />}
          aria-label={t('next')}
          onClick={() => onShiftWeek(1)}
        />
      </div>
      <ol className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((date) => {
          const isSelected = date === selected;
          const isToday = date === today;
          const level = presenceLevel(presence.get(date), today);
          const label = [
            formatGregorian(date, locale, true),
            isToday ? t('today') : null,
            level === 'full' ? tGrid('presenceFull') : level === 'partial' ? tGrid('presencePartial') : null,
          ]
            .filter(Boolean)
            .join(tGrid('separator'));
          return (
            <li key={date} className="flex">
              <button
                type="button"
                onClick={() => onSelect(date)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={label}
                className={cn(
                  'flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border px-0.5 py-2',
                  'transition-[background-color,border-color,color] duration-150 ease-out',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isToday
                      ? 'border-primary/60 text-foreground hover:bg-muted dark:border-ring/70'
                      : 'border-transparent text-foreground hover:bg-muted',
                )}
              >
                <span className={cn('text-xs', isSelected ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                  {formatWeekdayShort(date, locale)}
                </span>
                <span className="text-lg leading-none font-medium tabular-nums">{formatDigits(parseDate(date).day)}</span>
                <PresenceMark level={level} inverted={isSelected} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
