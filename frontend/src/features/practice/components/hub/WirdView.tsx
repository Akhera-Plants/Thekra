'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { periodicActs, upcomingPeriodic } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { wirdDay, wirdSummary } from '@/lib/practice/wird';
import { refreshPrayerTimes } from '@/lib/practice/screen-stores';
import { resendPushPrefs } from '@/lib/push/web-push';
import { useHeart } from '../../hooks/useHeart';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { HeartTop, MuraqabaLine, SelfMessageCard } from './HeartCards';
import { DayDoneCard, WeekCard } from './KnowledgeCards';
import { SyncStatus } from '../SyncStatus';
import { ExcuseToggle } from './ExcuseToggle';
import { HeavyDayToggle } from './HeavyDayToggle';
import { PeriodicRows } from './PeriodicRows';
import { TodayList } from './TodayList';
import { WirdHeader } from './WirdHeader';

/** How many periodic acts the daily screen shows; the rest is behind «الكل». */
const UPCOMING_LIMIT = 3;

/**
 * «ورد اليوم», top to bottom and nothing else (mirrors the app's centre tab):
 * 0. on a Friday, last week's «رسالة إلى نفسي» before anything else;
 * 1. the title, one date line (Gregorian; Hijri too with «إظهار التاريخ الهجري»), the streak chip and «أضف»;
 *    then one rotating text (المراقبة) and the cards of «نية اليوم», a due «التزام شخصي» and «المحاسبة»;
 * 2. «اليوم»: today's occasion as one compact line, one row per task, done rows at the bottom, off-day habits behind
 *    one collapsed row, and «يومي ثقيل» as a one-line toggle;
 * 3. «أعمال دورية»: the next three periodic acts and «الكل»;
 * 4. «شعبة الأسبوع»: one branch of faith for the ISO week, linking to its page.
 * A tick shows «تقبّل الله منك» for a moment; a complete day shows «تمّ وردك اليوم» with one reward text.
 * The month calendar, habit management, «تخفَّف» and the saved texts live in «سجلّي». `?add=1` opens «أضف».
 */
export function WirdView() {
  const context = useWirdContext();
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  // Prayer anchors: refresh the 30-day prayer times when they run low, then let the push planner know.
  useEffect(() => {
    void refreshPrayerTimes().then((result) => {
      if (result === 'updated') void resendPushPrefs(locale);
    });
  }, [locale]);
  const addOpen = useSearchParams().get('add') === '1';
  const snapshot = context?.snapshot;
  const heart = useHeart();
  const summary = useMemo(
    () => (context ? wirdSummary(context.snapshot.store, context.today, context.planDays) : null),
    [context],
  );

  return (
    <>
      {context && heart ? (
        <div className="mb-6 max-w-3xl empty:hidden">
          <SelfMessageCard heart={heart} today={context.today} />
        </div>
      ) : null}
      <WirdHeader
        date={context?.today ?? null}
        hijriOffset={snapshot?.store.settings.hijriOffset ?? 0}
        showHijri={snapshot?.prefs.showHijri === true}
        streak={summary?.hasPlans ? summary.streak : null}
        longest={summary?.longest ?? 0}
        addOpen={addOpen}
      />
      {context ? <MuraqabaLine today={context.today} /> : null}
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
  const heart = useHeart();
  const day = useMemo(() => wirdDay(store, today, { occasions, ...planDays }), [store, today, occasions, planDays]);
  const acts = useMemo(() => periodicActs(store, today, planDays), [store, today, planDays]);
  const upcoming = upcomingPeriodic(acts.map((act) => ({ act })), today, UPCOMING_LIMIT).map((row) => row.act);

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      {heart ? <HeartTop ctx={{ store, heart, today, time: context.time, habits, planDays }} /> : null}
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
        completeCard={<DayDoneCard store={store} today={today} habits={habits} planDays={planDays} />}
        footer={
          store.plans.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              <HeavyDayToggle store={store} today={today} />
              <ExcuseToggle store={store} today={today} />
            </div>
          ) : null
        }
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

      <WeekCard today={today} />

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
