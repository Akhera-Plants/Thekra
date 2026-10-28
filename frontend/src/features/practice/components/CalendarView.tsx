'use client';

import { useMemo } from 'react';
import { CalendarDays, CalendarPlus, Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { BrandLoader } from '@/components/shared/feedback/BrandLoader';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { occasionsIcsUrl } from '@/lib/api/practice';
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
import { useCalendarOccasions } from '../hooks/useCalendarOccasions';
import { useHijriLabel } from '../hooks/useHijriLabel';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useToday } from '../hooks/useToday';
import { HijriOffsetSelect } from './HijriOffsetSelect';
import { PracticeLoading } from './PracticeLoading';

/** «التقويم»: today in Hijri, the sunnah occasions of the coming year, subscribe or download. */
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
  // The catalog is the fallback: the same occasions computed on the device with practice-core.
  const catalog = usePracticeCatalog(occasions.isError);

  const rows = useMemo<UpcomingOccasion[] | null>(() => {
    if (!today || !range) return null;
    if (occasions.data) return groupOccasions(occasions.data, today);
    if (occasions.isError && catalog.data) {
      return groupOccasions(computeOccasionDates(catalog.data.occasions, range.from, range.to, offset), today);
    }
    return null;
  }, [today, range, occasions.data, occasions.isError, catalog.data, offset]);

  if (!clock || !snapshot) return <PracticeLoading />;

  const todayHijri = hijriLabel(clock.today, offset);
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
      <section className="next-step flex flex-col gap-1" aria-labelledby="calendar-today">
        <strong id="calendar-today">{t('today')}</strong>
        <p>{formatGregorian(clock.today, locale, true)}</p>
        {todayHijri ? <p className="text-lg font-medium text-primary">{todayHijri}</p> : <p>{t('hijriUnsupported')}</p>}
      </section>

      <HijriOffsetSelect value={offset} />

      <div className="flex flex-wrap gap-3">
        <a className="solid-button" href={occasionsIcsUrl(locale, 'webcal')}>
          <CalendarPlus aria-hidden />
          {t('subscribe')}
        </a>
        <button type="button" className="outline-button" onClick={handleDownload} disabled={!rows || rows.length === 0}>
          <Download aria-hidden />
          {t('download')}
        </button>
      </div>
      <p className="-mt-6 text-sm leading-7 text-muted-foreground">{t('subscribeHint')}</p>

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
              <OccasionRow key={row.key} row={row} hijri={hijriLabel(row.hijri ?? row.date, row.hijri ? 0 : offset)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OccasionRow({ row, hijri }: { row: UpcomingOccasion; hijri: string | null }) {
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
    </li>
  );
}
