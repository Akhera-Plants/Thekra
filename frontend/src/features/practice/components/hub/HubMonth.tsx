'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { presence, type DayPresence, type Store } from '@thekra/practice-core';
import { formatDigits } from '@/lib/format/digits';
import { computeOccasionDates, occasionsByDate } from '@/lib/practice/calendar';
import { firstOfMonth, lastOfMonth, type TrackSummary, type YearMonth } from '@/lib/practice/hub';
import { MONTH_DAYS } from '@/lib/practice/plans';
import type { PracticeOccasion } from '@/lib/types/practice';
import { MonthGrid } from './MonthGrid';
import { PresenceMark } from './PresenceMark';

interface HubMonthProps {
  store: Store;
  today: string;
  selected: string;
  month: YearMonth;
  occasions: readonly PracticeOccasion[] | undefined;
  summary: TrackSummary;
  onSelect: (date: string) => void;
  onMonthChange: (month: YearMonth) => void;
}

/**
 * «وين وصلت هذا الشهر»: days present in the last 30 and the plans' kind band, then the month with a presence mark per
 * day. Open on any day; never a run length, never a missed-day mark.
 */
export function HubMonth({ store, today, selected, month, occasions, summary, onSelect, onMonthChange }: HubMonthProps) {
  const t = useTranslations('practice.hub.month');
  const tGrid = useTranslations('practice.monthGrid');
  const tTracks = useTranslations('practice.hub.tracks');
  const hijriOffset = store.settings.hijriOffset;
  const first = firstOfMonth(month);
  const last = lastOfMonth(month);

  const days = useMemo(() => {
    const end = last < today ? last : today;
    if (first > end) return new Map<string, DayPresence>();
    return new Map(presence(store, first, end).map((day) => [day.date, day]));
  }, [store, first, last, today]);

  const marks = useMemo(
    () => occasionsByDate(occasions ? computeOccasionDates(occasions, first, last, hijriOffset) : []),
    [occasions, first, last, hijriOffset],
  );

  const line = [
    t('presentDays', { count: summary.presentDays, n: formatDigits(summary.presentDays), total: formatDigits(MONTH_DAYS) }),
    summary.band ? tTracks(`band.${summary.band}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-labelledby="hub-month-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="hub-month-title" className="text-xl font-medium">
          {t('title')}
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">{line}</p>
      </div>
      <MonthGrid
        month={month}
        today={today}
        selected={selected}
        hijriOffset={hijriOffset}
        occasions={marks}
        presence={days}
        onSelect={onSelect}
        onMonthChange={onMonthChange}
      />
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <PresenceMark level="full" />
          {tGrid('presenceFull')}
        </li>
        <li className="flex items-center gap-1.5">
          <PresenceMark level="partial" />
          {tGrid('presencePartial')}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-intent-good-deed" />
          {tGrid('occasion')}
        </li>
      </ul>
    </section>
  );
}
