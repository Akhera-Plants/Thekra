'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { activePrograms, addDays, fardEnabled, nextPrayer, nextPrayerLine } from '@thekra/practice-core';
import { useRouter } from '@/i18n/navigation';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { TitleRow } from '@/components/shared/kit/title-row';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGregorian } from '@/lib/practice/format';
import { splitWirdDay, wirdDay } from '@/lib/practice/wird';
import { limitOptions } from '@/lib/practice/limits';
import { currentPrayerTimes, refreshPrayerTimes, usePrayerTimesToday } from '@/lib/practice/screen-stores';
import { weekBranchOn } from '@/lib/practice/week-branch';
import { resendPushPrefs } from '@/lib/push/web-push';
import { cn } from '@/lib/utils';
import { useHeart } from '../../hooks/useHeart';
import { useHijriLabel } from '../../hooks/useHijriLabel';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { SyncStatus } from '../SyncStatus';
import { AddHabitFlow } from '../wird/AddHabitFlow';
import { DayStateMenu } from '../wird/DayStateMenu';
import { FardSection } from '../wird/FardSection';
import { HeartSlotCard } from '../wird/HeartSlotCard';
import { Onboarding, useOnboardingDone } from '../wird/Onboarding';
import { AddMenu } from './AddMenu';
import { DayDoneCard, TallySection, WeekCard } from './KnowledgeCards';
import { TodayList } from './TodayList';

/**
 * «عاداتي › ورد اليوم» (round 5, F-06 a; the same order as the app), top to bottom:
 * 1. the title row: today's date (and the next prayer when a city is set), «حال يومي» and «أضف»;
 * 2. ONE heart card (practice-core `heartSlot`);
 * 3. «الفرائض» when it is on (F-05 a);
 * 4. today's habits (a circle logs; the row opens the habit page; «صلّحها» after a missed day, F-08 a);
 * 5. the periodic acts due today or overdue only (F-14 a; hidden when none);
 * 6. one collapsed «المزيد لليوم» («شعبة الأسبوع» when chosen, «حصيلتي»).
 * No verse line on top (O-06 b). Sections are parted by the flower divider. `?add=1` opens «أضف عادة» in place;
 * a new member without habits gets the three-step start first (F-26 a).
 */
export function WirdView() {
  const context = useWirdContext();
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const router = useRouter();
  const params = useSearchParams();
  const adding = params.get('add') === '1';
  const habitKey = adding ? params.get('habit') : null;
  const onboarded = useOnboardingDone();
  // Prayer anchors: refresh the 30-day prayer times when they run low, then let the push planner know.
  useEffect(() => {
    void refreshPrayerTimes().then((result) => {
      if (result === 'updated') void resendPushPrefs(locale);
    });
  }, [locale]);

  if (!context) return <WirdSkeleton />;
  const { store } = context.snapshot;
  if (adding) return <AddHabitFlow context={context} habitKey={habitKey} onClose={() => router.replace('/practice')} />;

  const isNew = store.plans.length === 0 && activePrograms(store.programs).length === 0;
  if (isNew && onboarded === false && context.catalog.data) {
    return <Onboarding habits={context.catalog.data.habits} today={context.today} />;
  }
  return <WirdBody context={context} />;
}

function WirdBody({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.wird');
  const tToday = useTranslations('practice.today');
  const tPeriodic = useTranslations('practice.periodic');
  const { snapshot, today, habits, occasions, occasionBasis, planDays, catalog } = context;
  const { store } = snapshot;
  const heart = useHeart();
  const day = useMemo(() => wirdDay(store, today, { occasions, ...planDays }), [store, today, occasions, planDays]);
  // Habits in one list, the periodic acts due today or overdue in another (F-14 a): each row logs with its circle.
  const { habits: habitsDay, periodic: periodicDay } = useMemo(() => {
    const { isPeriodicAct } = limitOptions(habits);
    return splitWirdDay(day, (planId) => {
      const plan = store.plans.find((p) => p.id === planId);
      return plan ? (isPeriodicAct?.(plan) ?? false) : false;
    });
  }, [day, habits, store.plans]);
  const hasPeriodic = periodicDay.open.length + periodicDay.done.length > 0;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <DayTitleRow context={context} />
      {heart ? <HeartSlotCard ctx={{ store, heart, today, time: context.time, habits, planDays }} /> : null}
      {catalog.isError ? (
        <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} message={tToday('catalogError')} className="py-4" />
      ) : null}

      {fardEnabled(store) ? (
        <>
          <FardSection store={store} today={today} />
          <SectionDivider />
        </>
      ) : null}

      <TodayList
        title={t('habitsToday')}
        store={store}
        date={today}
        today={today}
        day={habitsDay}
        habits={habits}
        occasionBasis={occasionBasis}
        canAdd
        heart={heart}
        planDays={planDays}
        completeCard={<DayDoneCard store={store} today={today} planDays={planDays} />}
      />

      {hasPeriodic ? (
        <>
          <SectionDivider />
          <TodayList
            title={tPeriodic('dueTitle')}
            store={store}
            date={today}
            today={today}
            day={periodicDay}
            habits={habits}
            occasionBasis={occasionBasis}
            secondary
          />
        </>
      ) : null}

      <MoreForToday context={context} />
      <SyncStatus persistent={snapshot.persistent} quiet />
    </div>
  );
}

/** The day's title row: the date (Hijri too when chosen), the next prayer when a city is set, «حال يومي» and «أضف». */
function DayTitleRow({ context }: { context: WirdContext }) {
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const hijri = useHijriLabel();
  const { snapshot, today, time, habits } = context;
  const { store, prefs } = snapshot;
  const times = usePrayerTimesToday();
  const line = useMemo(() => {
    if (!times) return null;
    try {
      return nextPrayerLine(nextPrayer(times, time, currentPrayerTimes(addDays(today, 1))), locale);
    } catch {
      return null;
    }
  }, [times, time, today, locale]);
  const hijriDate = prefs.showHijri ? hijri(today, store.settings.hijriOffset) : null;

  return (
    <TitleRow
      className="flex-wrap gap-y-3"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DayStateMenu store={store} today={today} />
          <AddMenu store={store} today={today} habits={habits} />
        </div>
      }
    >
      <h2 className="text-xl font-medium sm:text-2xl">{formatGregorian(today, locale, true)}</h2>
      {hijriDate || line ? (
        <p className="text-sm leading-7 text-muted-foreground">
          {[hijriDate, line].filter(Boolean).join(' · ')}
        </p>
      ) : null}
    </TitleRow>
  );
}

/** One collapsed row «المزيد لليوم»: «شعبة الأسبوع» (when chosen) and «حصيلتي». Closed on every visit. */
function MoreForToday({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.wird');
  const [open, setOpen] = useState(false);
  const id = useId();
  const { snapshot, today, habits } = context;
  const branch = weekBranchOn(snapshot.store, snapshot.prefs);
  if (snapshot.store.plans.length === 0 && !branch) return null;
  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-start text-base font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex-1">{t('more')}</span>
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-150 motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
      <div id={id} hidden={!open} className="flex flex-col gap-8">
        {open ? (
          <>
            {branch ? <WeekCard today={today} /> : null}
            {branch && snapshot.store.plans.length > 0 ? <SectionDivider /> : null}
            {snapshot.store.plans.length > 0 ? <TallySection store={snapshot.store} today={today} habits={habits} /> : null}
          </>
        ) : null}
      </div>
    </section>
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
      <Skeleton className="h-8 w-40" />
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
