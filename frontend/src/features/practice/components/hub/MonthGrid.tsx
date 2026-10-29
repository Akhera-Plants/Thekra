'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, parseDate, toHijri, weekday, isHijriSupported, type DayPresence } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian, formatMonth, formatWeekdayShort } from '@/lib/practice/format';
import {
  compareMonths,
  firstOfMonth,
  hijriMonthSpan,
  isInMonth,
  lastOfMonth,
  monthOf,
  monthWeeks,
  presenceLevel,
  shiftMonth,
  weekOf,
  weekStartFor,
  type YearMonth,
} from '@/lib/practice/hub';
import { cn } from '@/lib/utils';
import { useHijriLabel, useHijriMonthLabel } from '../../hooks/useHijriLabel';
import { PresenceMark } from './PresenceMark';

interface MonthGridOccasion {
  key: string;
  titleAr: string;
  titleEn: string;
}

interface MonthGridProps {
  month: YearMonth;
  today: string;
  selected: string;
  hijriOffset: number;
  /** Sunnah occasions per date: a mark on the day, and their names in its label. */
  occasions: ReadonlyMap<string, readonly MonthGridOccasion[]>;
  /** «عاداتي»: the day's presence mark. Absent on «التقويم». */
  presence?: ReadonlyMap<string, DayPresence>;
  /** «التقويم»: the Hijri day under each Gregorian day. */
  showHijriDay?: boolean;
  minMonth?: YearMonth;
  maxMonth?: YearMonth;
  onSelect: (date: string) => void;
  onMonthChange: (month: YearMonth) => void;
}

const DAYS_IN_WEEK = 7;

/** Arrow keys move by day and week (reading order, so RTL-aware), Home/End to the week's ends, PageUp/Down by month. */
function keyTarget(key: string, date: string, weekStart: number, rtl: boolean): string | null {
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  const sameDayIn = (delta: number) => {
    const target = shiftMonth(monthOf(date), delta);
    const day = Math.min(parseDate(date).day, parseDate(lastOfMonth(target)).day);
    return `${firstOfMonth(target).slice(0, 8)}${String(day).padStart(2, '0')}`;
  };
  switch (key) {
    case forward:
      return addDays(date, 1);
    case back:
      return addDays(date, -1);
    case 'ArrowDown':
      return addDays(date, DAYS_IN_WEEK);
    case 'ArrowUp':
      return addDays(date, -DAYS_IN_WEEK);
    case 'Home':
      return weekOf(date, weekStart)[0] as string;
    case 'End':
      return weekOf(date, weekStart)[DAYS_IN_WEEK - 1] as string;
    case 'PageUp':
      return sameDayIn(-1);
    case 'PageDown':
      return sameDayIn(1);
    default:
      return null;
  }
}

/**
 * A month as a real calendar: Gregorian month with the Hijri month(s) beside it, days in reading order, today outlined,
 * the selected day filled, sunnah occasions marked. One day is in the Tab order; arrow keys move between days and
 * across months, Enter or Space selects.
 */
export function MonthGrid({
  month,
  today,
  selected,
  hijriOffset,
  occasions,
  presence,
  showHijriDay = false,
  minMonth,
  maxMonth,
  onSelect,
  onMonthChange,
}: MonthGridProps) {
  const t = useTranslations('practice.monthGrid');
  const tDays = useTranslations('practice.weekdays');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const hijriLabel = useHijriLabel();
  const hijriMonthLabel = useHijriMonthLabel();
  const titleId = useId();
  const tableRef = useRef<HTMLTableElement>(null);
  const pendingFocus = useRef(false);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const weekStart = weekStartFor(locale);
  const weeks = monthWeeks(month, weekStart);
  const hijriOk = isHijriSupported();
  const hijriMonth = hijriMonthLabel(hijriMonthSpan(month, hijriOffset));
  const canGoBack = !minMonth || compareMonths(month, minMonth) > 0;
  const canGoForward = !maxMonth || compareMonths(month, maxMonth) < 0;
  const tabbable = [focusDate, selected, today].find((d) => d !== null && isInMonth(d, month)) ?? firstOfMonth(month);

  useEffect(() => {
    if (!pendingFocus.current || !focusDate) return;
    pendingFocus.current = false;
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate, month]);

  function handleKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const date = (event.target as HTMLElement).dataset.date;
    if (!date) return;
    const next = keyTarget(event.key, date, weekStart, locale === 'ar');
    if (!next) return;
    event.preventDefault();
    const nextMonth = monthOf(next);
    if ((minMonth && compareMonths(nextMonth, minMonth) < 0) || (maxMonth && compareMonths(nextMonth, maxMonth) > 0)) return;
    if (compareMonths(nextMonth, month) !== 0) onMonthChange(nextMonth);
    pendingFocus.current = true;
    setFocusDate(next);
  }

  function dayLabel(date: string): string {
    const names = (occasions.get(date) ?? []).map((o) => (locale === 'en' ? o.titleEn : o.titleAr));
    const level = presence ? presenceLevel(presence.get(date), today) : 'none';
    return [
      formatGregorian(date, locale, true),
      hijriOk ? hijriLabel(date, hijriOffset) : null,
      date === today ? t('today') : null,
      ...names,
      level === 'full' ? t('presenceFull') : level === 'partial' ? t('presencePartial') : null,
    ]
      .filter(Boolean)
      .join(t('separator'));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          tone="neutral"
          iconOnly
          icon={<ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />}
          aria-label={t('previous')}
          disabled={!canGoBack}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        />
        <div id={titleId} className="flex min-w-0 flex-1 flex-col items-center text-center" aria-live="polite">
          <span className="text-lg font-medium">{formatMonth(month.year, month.month, locale)}</span>
          {hijriMonth ? <span className="text-sm text-muted-foreground">{hijriMonth}</span> : null}
        </div>
        <Button
          variant="ghost"
          tone="neutral"
          iconOnly
          icon={<ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />}
          aria-label={t('next')}
          disabled={!canGoForward}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        />
      </div>

      <table ref={tableRef} aria-labelledby={titleId} className="w-full table-fixed border-separate border-spacing-1" onKeyDown={handleKeyDown}>
        <thead>
          <tr>
            {weekOf(firstOfMonth(month), weekStart).map((date) => (
              <th key={date} scope="col" className="pb-1 text-xs font-normal text-muted-foreground">
                <abbr title={tDays(`d${weekday(date)}`)} className="no-underline">
                  {formatWeekdayShort(date, locale)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.find((d) => d !== null) ?? 'blank'}>
              {week.map((date, index) =>
                date === null ? (
                  <td key={`blank-${index}`} />
                ) : (
                  <td key={date} className="p-0">
                    <DayCell
                      date={date}
                      label={dayLabel(date)}
                      isToday={date === today}
                      isSelected={date === selected}
                      isTabbable={date === tabbable}
                      hasOccasion={occasions.has(date)}
                      hijriDay={showHijriDay && hijriOk ? toHijri(date, hijriOffset).day : null}
                      level={presence ? presenceLevel(presence.get(date), today) : null}
                      onSelect={onSelect}
                      onFocus={setFocusDate}
                    />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DayCellProps {
  date: string;
  label: string;
  isToday: boolean;
  isSelected: boolean;
  isTabbable: boolean;
  hasOccasion: boolean;
  hijriDay: number | null;
  level: ReturnType<typeof presenceLevel> | null;
  onSelect: (date: string) => void;
  onFocus: (date: string) => void;
}

function DayCell({ date, label, isToday, isSelected, isTabbable, hasOccasion, hijriDay, level, onSelect, onFocus }: DayCellProps) {
  return (
    <button
      type="button"
      data-date={date}
      tabIndex={isTabbable ? 0 : -1}
      aria-label={label}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      onClick={() => onSelect(date)}
      onFocus={() => onFocus(date)}
      className={cn(
        'relative flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl border py-1.5',
        'transition-[background-color,border-color,color] duration-150 ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isSelected
          ? 'border-primary bg-primary text-primary-foreground'
          : isToday
            ? 'border-primary/70 hover:bg-muted dark:border-ring/70'
            : 'border-transparent hover:bg-muted',
      )}
    >
      {hasOccasion ? (
        <span
          aria-hidden
          className={cn(
            'absolute end-1 top-1 size-1.5 rounded-full',
            isSelected ? 'bg-primary-foreground' : 'bg-intent-good-deed',
          )}
        />
      ) : null}
      <span className="text-sm leading-none font-medium tabular-nums">{formatDigits(parseDate(date).day)}</span>
      {hijriDay !== null ? (
        <span className={cn('text-[0.6875rem] leading-none tabular-nums', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          {formatDigits(hijriDay)}
        </span>
      ) : null}
      {level !== null ? <PresenceMark level={level} inverted={isSelected} /> : null}
    </button>
  );
}
