'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { periodicActs, upcomingPeriodic } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { wirdDay, wirdSummary } from '@/lib/practice/wird';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { SyncStatus } from '../SyncStatus';
import { HeavyDayToggle } from './HeavyDayToggle';
import { PeriodicRows } from './PeriodicRows';
import { TodayList } from './TodayList';
import { WirdHeader } from './WirdHeader';

/** How many periodic acts the daily screen shows; the rest is behind «الكل». */
const UPCOMING_LIMIT = 3;

/**
 * «ورد اليوم», top to bottom and nothing else (mirrors the app's centre tab):
 * 1. the title, one date line (Gregorian; Hijri too with «إظهار التاريخ الهجري»), the streak chip and «أضف»;
 * 2. «اليوم»: today's occasion as one compact line, one row per task, done rows at the bottom, off-day habits behind
 *    one collapsed row, and «يومي ثقيل» as a one-line toggle;
 * 3. «أعمال دورية»: the next three periodic acts and «الكل».
 * The month calendar, habit management, «تخفَّف» and the saved texts live in «سجلّي». `?add=1` opens «أضف».
 */
export function WirdView() {
  const context = useWirdContext();
  const addOpen = useSearchParams().get('add') === '1';
  const snapshot = context?.snapshot;
  const summary = useMemo(
    () => (context ? wirdSummary(context.snapshot.store, context.today, context.planDays) : null),
    [context],
  );

  return (
    <>
      <WirdHeader
        date={context?.today ?? null}
        hijriOffset={snapshot?.store.settings.hijriOffset ?? 0}
        showHijri={snapshot?.prefs.showHijri === true}
        streak={summary?.hasPlans ? summary.streak : null}
        addOpen={addOpen}
      />
      {context ? <WirdBody context={context} /> : <WirdSkeleton />}
    </>
  );
}

function WirdBody({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.wird');
  const tPeriodic = useTranslations('practice.periodic');
  const tToday = useTranslations('practice.today');
  const { snapshot, today, habits, occasions, occasionBasis, planDays, catalog } = context;
  const { store } = snapshot;
  const day = useMemo(() => wirdDay(store, today, { occasions, ...planDays }), [store, today, occasions, planDays]);
  const acts = useMemo(() => periodicActs(store, today, planDays), [store, today, planDays]);
  const upcoming = upcomingPeriodic(acts.map((act) => ({ act })), today, UPCOMING_LIMIT).map((row) => row.act);

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      {catalog.isError ? (
        <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} message={tToday('catalogError')} className="py-4" />
      ) : null}

      <TodayList
        title={t('today')}
        store={store}
        date={today}
        today={today}
        day={day}
        habits={habits}
        occasionBasis={occasionBasis}
        canAdd
        footer={store.plans.length > 0 ? <HeavyDayToggle store={store} today={today} /> : null}
      />

      <section aria-labelledby="wird-periodic-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="wird-periodic-title" className="text-xl font-medium">
            {tPeriodic('title')}
          </h2>
          {acts.length > 0 ? (
            <Link href="/practice/periodic" className="text-link text-sm">
              {tPeriodic('all')}
            </Link>
          ) : null}
        </div>
        {acts.length === 0 ? (
          <Link href="/practice/periodic" className="text-link self-start">
            {tPeriodic('add')}
          </Link>
        ) : upcoming.length > 0 ? (
          <PeriodicRows acts={upcoming} store={store} today={today} habits={habits} />
        ) : null}
      </section>

      <SyncStatus persistent={snapshot.persistent} quiet />
    </div>
  );
}

const SKELETON_ROWS = ['r1', 'r2', 'r3'];

/** The device store does not exist during the server render: the list's shape, without numbers. */
function WirdSkeleton() {
  const t = useTranslations('feedback');
  return (
    <div className="flex max-w-3xl flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">
        {t('loading')}
      </span>
      <Skeleton className="h-8 w-28" />
      {SKELETON_ROWS.map((key) => (
        <div key={key} className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
