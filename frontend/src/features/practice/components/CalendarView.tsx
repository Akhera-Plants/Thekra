'use client';

import { useMemo } from 'react';
import { CalendarDays, CalendarPlus, Repeat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import {
  calendarRange,
  computeOccasionDates,
  groupOccasions,
  occasionsIcs,
  type UpcomingOccasion,
} from '@/lib/practice/calendar';
import { downloadTextFile, ICS_MIME } from '@/lib/practice/download';
import { formatGregorian } from '@/lib/practice/format';
import { localePath } from '@/lib/seo';
import { formatDigits } from '@/lib/format/digits';
import type { OccasionDate } from '@/lib/types/practice';
import { useCalendarOccasions } from '../hooks/useCalendarOccasions';
import { useHijriLabel } from '../hooks/useHijriLabel';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useToday } from '../hooks/useToday';
import { CalendarMonth } from './CalendarMonth';
import { HijriOffsetSelect } from './HijriOffsetSelect';
import { PracticeLoading } from './PracticeLoading';

/**
 * «مواسم الخير» (`/calendar`, owner 2026-11-01: as little text as possible): one action, «أضف مواسم الخير إلى تقويمك»
 * (the file is built here, with this device's Hijri adjustment), the month, and the coming occasions; each leads to its
 * deed and, when the catalog has a habit for that deed, «اجعلها عادة». The Hijri adjustment sits at the end.
 */
export function CalendarView() {
  const t = useTranslations('calendarPage');
  const tFeedback = useTranslations('feedback');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const clock = useToday();
  const snapshot = usePracticeStore();
  const hijriLabel = useHijriLabel();
  const offset = snapshot?.store.settings.hijriOffset ?? 0;
  const today = clock?.today ?? null;
  const range = useMemo(() => (today ? calendarRange(today) : null), [today]);
  const occasions = useCalendarOccasions(range && snapshot ? { ...range, hijriOffset: offset } : null);
  // The catalog: the habit each deed can become, and the fallback (the same occasions computed on the device).
  const catalog = usePracticeCatalog();
  const habitOfDeed = useMemo(() => {
    const map = new Map<string, string>();
    for (const habit of catalog.data?.habits ?? []) if (!map.has(habit.deed)) map.set(habit.deed, habit.key);
    return map;
  }, [catalog.data]);

  const entries = useMemo<OccasionDate[] | null>(() => {
    if (!range) return null;
    if (occasions.data) return occasions.data;
    if (occasions.isError && catalog.data) return computeOccasionDates(catalog.data.occasions, range.from, range.to, offset);
    return null;
  }, [range, occasions.data, occasions.isError, catalog.data, offset]);
  const rows = useMemo<UpcomingOccasion[] | null>(
    () => (entries && today ? groupOccasions(entries, today) : null),
    [entries, today],
  );

  if (!clock || !snapshot) return <PracticeLoading />;

  const failed = occasions.isError && catalog.isError;

  function handleDownload() {
    if (!rows) return;
    const origin = window.location.origin;
    const text = occasionsIcs(rows, locale, t('icsName'), (deed) =>
      new URL(localePath(locale, `/good-deeds/${deed}`), origin).toString(),
    );
    downloadTextFile('thekra-occasions.ics', text, ICS_MIME);
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="solid-button button-wrap self-start"
          onClick={handleDownload}
          disabled={!rows || rows.length === 0}
        >
          <CalendarPlus aria-hidden />
          {t('addToCalendar')}
        </button>
        <p className="text-sm leading-7 text-muted-foreground">{t('addToCalendarHint')}</p>
      </div>

      {entries && range ? <CalendarMonth entries={entries} today={clock.today} hijriOffset={offset} to={range.to} /> : null}

      <section aria-labelledby="calendar-upcoming" className="flex flex-col gap-4">
        <h2 id="calendar-upcoming" className="text-2xl font-medium">
          {t('upcoming')}
        </h2>
        {failed ? (
          <QueryErrorState
            error={catalog.error}
            onRetry={() => {
              void occasions.refetch();
              void catalog.refetch();
            }}
          />
        ) : rows === null ? (
          <BrandLoader label={tFeedback('loadingList')} showLabel />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border" aria-busy={occasions.isFetching}>
            {rows.map((row) => (
              <OccasionRow
                key={row.key}
                row={row}
                hijri={hijriLabel(row.hijri ?? row.date, row.hijri ? 0 : offset)}
                habitKey={habitOfDeed.get(row.deed)}
              />
            ))}
          </ul>
        )}
      </section>

      <HijriOffsetSelect value={offset} />
    </div>
  );
}

function OccasionRow({ row, hijri, habitKey }: { row: UpcomingOccasion; hijri: string | null; habitKey: string | undefined }) {
  const t = useTranslations('calendarPage');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const title = locale === 'en' ? row.titleEn : row.titleAr;
  const when =
    row.until === row.date
      ? formatGregorian(row.date, locale, true)
      : t('range', { from: formatGregorian(row.date, locale, true), to: formatGregorian(row.until, locale) });
  return (
    <li className="flex flex-col gap-1 py-5">
      <Link href={`/good-deeds/${row.deed}`} className="text-link self-start text-lg">
        <CalendarDays aria-hidden />
        <span>{title}</span>
        <DirectionalArrow />
      </Link>
      <p className="text-sm leading-7 text-muted-foreground">
        {when}
        {hijri ? <> · {hijri}</> : null}
        {' · '}
        <strong className="font-medium text-foreground">
          {t('daysAway', { count: row.daysAway, n: formatDigits(row.daysAway) })}
        </strong>
      </p>
      {row.basis === 'organizational' ? <p className="text-sm text-muted-foreground">{t('organizational')}</p> : null}
      {habitKey ? (
        <Link href={{ pathname: '/practice/habits', query: { add: '1', habit: habitKey } }} className="text-link self-start text-sm">
          <Repeat aria-hidden />
          {t('makeHabit')}
        </Link>
      ) : null}
    </li>
  );
}
