'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, CalendarSync, Download, Repeat } from 'lucide-react';
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
import { Button } from '@/components/shared/kit/button';
import { tidyArabicNumberRuns } from '@/lib/format/ranges';
import { ActionPair } from '@/components/shared/kit/action-pair';
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
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { occasionsIcsUrl } from '@/lib/api/practice';
import { PracticeLoading } from './PracticeLoading';

/**
 * «مواسم الخير» (`/calendar`, owner round 3): two tabs. «المناسبات القادمة»: «أضفها إلى تقويمك» with «اشترك في
 * التقويم» (the API's public `webcal:` feed, re-read daily) and «نزّل ملف التقويم» (built here with this device's Hijri
 * adjustment), then the coming occasions, each leading to its deed and «اجعلها عادة» when the catalog has one. «الشهر»:
 * the month calendar. The Hijri adjustment opens from an icon (a dialog).
 */
export function CalendarView() {
  const t = useTranslations('calendarPage');
  const tFeedback = useTranslations('feedback');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const clock = useToday();
  const snapshot = usePracticeStore();
  const hijriLabel = useHijriLabel();
  const [tab, setTab] = useState('upcoming');
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

  const webcal = occasionsIcsUrl(locale, 'webcal');
  const visibleTab = tab === 'month' ? 'month' : 'upcoming';

  return (
    <div className="flex flex-col gap-8">
      <SegmentTabs
        aria-label={t('tabsLabel')}
        items={[
          { value: 'upcoming', label: t('upcoming') },
          { value: 'month', label: t('month.title') },
        ]}
        value={visibleTab}
        onValueChange={setTab}
        className="gap-8"
      >
        <SegmentTabsContent value="upcoming" className="flex flex-col gap-6">
          <section aria-labelledby="calendar-add" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <h2 id="calendar-add" className="text-lg font-medium">
              {t('addToCalendar')}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">{t('addToCalendarHint')}</p>
            {/* One pair, same size, side by side (O-02/W-03): subscribing is the main way, the file the other. */}
            <ActionPair>
              <Button asChild variant="solid" tone="primary" size="md">
                <a href={webcal}>
                  <CalendarSync aria-hidden />
                  {t('subscribe')}
                </a>
              </Button>
              <Button variant="outline" tone="primary" size="md" icon={<Download aria-hidden />} onClick={handleDownload} disabled={!rows || rows.length === 0}>
                {t('download')}
              </Button>
            </ActionPair>
          </section>

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
            <ul className="flex flex-col divide-y divide-border border-y border-border" aria-busy={occasions.isFetching} aria-label={t('upcoming')}>
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
        </SegmentTabsContent>

        <SegmentTabsContent value="month">
          {entries && range ? (
            <CalendarMonth entries={entries} today={clock.today} hijriOffset={offset} to={range.to} />
          ) : failed ? null : (
            <BrandLoader label={tFeedback('loadingList')} showLabel />
          )}
        </SegmentTabsContent>
      </SegmentTabs>
    </div>
  );
}

function OccasionRow({ row, hijri, habitKey }: { row: UpcomingOccasion; hijri: string | null; habitKey: string | undefined }) {
  const t = useTranslations('calendarPage');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const title = locale === 'en' ? row.titleEn : tidyArabicNumberRuns(row.titleAr);
  const when =
    row.until === row.date
      ? formatGregorian(row.date, locale, true)
      : t('range', { from: formatGregorian(row.date, locale, true), to: formatGregorian(row.until, locale) });
  return (
    <li className="flex flex-col gap-1 py-5">
      <Link href={`/good-deeds/${row.deed}`} className="group flex items-center gap-2 self-start text-lg font-medium hover:text-primary-text">
        <CalendarDays aria-hidden className="size-5 text-primary-text" />
        <span>{title}</span>
        <DirectionalArrow className="size-4 text-muted-foreground" />
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
        <Button asChild variant="outline" tone="primary" size="sm" className="self-start">
          <Link href={{ pathname: '/practice/habits', query: { add: '1', habit: habitKey } }}>
            <Repeat aria-hidden />
            {t('makeHabit')}
          </Link>
        </Button>
      ) : null}
    </li>
  );
}
