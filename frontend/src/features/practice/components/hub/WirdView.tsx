'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { activePrograms, addDays, fardEnabled, nextPrayer, nextPrayerLine, parseDate } from '@thekra/practice-core';
import { Link, useRouter } from '@/i18n/navigation';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { TitleRow } from '@/components/shared/kit/title-row';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { periodicActsOnly, splitWirdDay, wirdDay, type WirdDay } from '@/lib/practice/wird';
import { limitOptions } from '@/lib/practice/limits';
import { habitOf } from '@/lib/practice/plans';
import { currentPrayerTimes, refreshPrayerTimes, usePrayerTimesToday } from '@/lib/practice/screen-stores';
import { weekBranchOn } from '@/lib/practice/week-branch';
import { resendPushPrefs } from '@/lib/push/web-push';
import { cn } from '@/lib/utils';
import { useHeart } from '../../hooks/useHeart';
import { useHijriLabel } from '../../hooks/useHijriLabel';
import { useWideScreen } from '../../hooks/useWideScreen';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { DayDetailsDialog } from '../day/DayDetails';
import { usePlanWords } from '../plan-words';
import { SyncStatus } from '../SyncStatus';
import { AsksCard } from '../today/AsksCard';
import { WeekStrip } from '../today/WeekStrip';
import { AddHabitFlow } from '../wird/AddHabitFlow';
import { DayStateLine, DayStateMenu } from '../wird/DayStateMenu';
import { FardSection } from '../wird/FardSection';
import { HeartSlotCard } from '../wird/HeartSlotCard';
import { Onboarding, useOnboardingDone } from '../wird/Onboarding';
import { AddMenu } from './AddMenu';
import { DayDoneCard, TallySection, WeekCard } from './KnowledgeCards';
import { TodayList } from './TodayList';

/**
 * «عاداتي › اليوم» (round 6 §2, C-01r / C-02a / C-03b; reference «اليوم» layout with our visuals):
 * - the week strip from the review day (past days open their details, future days are view-only);
 * - the day's title row: the date (Hijri and the next prayer when set), «حال يومي» (a list of states) and «أضف»;
 * - «هل فعلتها؟» for recent days without a log; the gentle line of a hard day;
 * - the groups «الفرائض · عادات اليوم · الأعمال الدورية» reachable WITHOUT scrolling: a segment row selects one on a
 *   phone; on a wide screen «عادات اليوم» comes first and the other two sit side by side under it. Habits are grouped by
 *   the part of the day, a counted habit has its inline counter, «صلّحها» shows on a row in a gap;
 * - a side column (after the groups on a phone): ONE heart card, the coming periodic acts, «المزيد لليوم».
 * `?add=1` opens «أضف عادة» in place; a new member without habits gets the three-step start first (F-26 a).
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
  return <TodayBody context={context} />;
}

type GroupKey = 'fard' | 'habits' | 'periodic';

function TodayBody({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.todayTab');
  const tToday = useTranslations('practice.today');
  const { snapshot, today, habits, occasions, occasionBasis, planDays, catalog } = context;
  const { store } = snapshot;
  const heart = useHeart();
  const wide = useWideScreen();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const day = useMemo(() => wirdDay(store, today, { occasions, ...planDays }), [store, today, occasions, planDays]);
  // Habits in one group, the periodic acts due today or overdue in another (F-14 a): each row logs with its circle.
  const { habits: habitsDay, periodic: periodicDay } = useMemo(() => {
    const { isPeriodicAct } = limitOptions(habits);
    return splitWirdDay(day, (planId) => {
      const plan = store.plans.find((p) => p.id === planId);
      return plan ? (isPeriodicAct?.(plan) ?? false) : false;
    });
  }, [day, habits, store.plans]);

  const groups: GroupKey[] = [
    ...(fardEnabled(store) ? (['fard'] as const) : []),
    'habits',
    ...(periodicDay.open.length + periodicDay.done.length > 0 ? (['periodic'] as const) : []),
  ];
  const [picked, setPicked] = useState<GroupKey>('habits');
  const current = groups.includes(picked) ? picked : 'habits';
  const openCount = (d: WirdDay) => d.open.length;

  const habitsList = (
    <div className="flex flex-col gap-6">
      <TodayList
        title={t('groups.habits')}
        hideTitle={!wide}
        store={store}
        date={today}
        today={today}
        day={habitsDay}
        habits={habits}
        occasionBasis={occasionBasis}
        canAdd
        heart={heart}
        planDays={planDays}
        dayParts
        completeCard={<DayDoneCard store={store} today={today} planDays={planDays} />}
      />
      {/* Today's rows first; the recent days still waiting for «هل فعلتها؟» right under them. */}
      <AsksCard context={context} />
    </div>
  );
  const periodicList = (
    <TodayList
      title={t('groups.periodic')}
      hideTitle={!wide}
      store={store}
      date={today}
      today={today}
      day={periodicDay}
      habits={habits}
      occasionBasis={occasionBasis}
      secondary
    />
  );
  const fardList = <FardSection store={store} today={today} />;
  const groupBody = (key: GroupKey) => (key === 'fard' ? fardList : key === 'habits' ? habitsList : periodicList);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <WeekStrip context={context} heart={heart} onOpenDay={setOpenDay} />
        <DayTitleRow context={context} />
        <DayStateLine store={store} today={today} />
        {catalog.isError ? (
          <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} message={tToday('catalogError')} className="py-4" />
        ) : null}

        {wide ? (
          <div className="flex flex-col gap-8">
            {habitsList}
            {groups.length > 1 ? (
              <>
                <SectionDivider />
                <div className={cn('grid gap-10', groups.length === 3 && 'xl:grid-cols-2')}>
                  {groups.includes('fard') ? <div className="min-w-0">{fardList}</div> : null}
                  {groups.includes('periodic') ? <div className="min-w-0">{periodicList}</div> : null}
                </div>
              </>
            ) : null}
          </div>
        ) : groups.length > 1 ? (
          <SegmentTabs
            aria-label={t('groupsLabel')}
            value={current}
            onValueChange={(v) => setPicked(v as GroupKey)}
            variant="segment"
            size="filled"
            listClassName="mb-5"
            items={groups.map((key) => ({
              value: key,
              label: t(`groups.${key}`),
              count: key === 'habits' ? openCount(habitsDay) || undefined : key === 'periodic' ? openCount(periodicDay) || undefined : undefined,
            }))}
          >
            {groups.map((key) => (
              <SegmentTabsContent key={key} value={key} className="outline-none">
                {groupBody(key)}
              </SegmentTabsContent>
            ))}
          </SegmentTabs>
        ) : (
          habitsList
        )}
      </div>

      <aside aria-label={t('sideLabel')} className="flex min-w-0 flex-col gap-8 lg:border-s lg:border-border lg:ps-10">
        {heart ? <HeartSlotCard ctx={{ store, heart, today, time: context.time, habits, planDays }} /> : null}
        <Upcoming context={context} />
        <MoreForToday context={context} />
        <SyncStatus persistent={snapshot.persistent} quiet />
      </aside>
      <DayDetailsDialog context={context} heart={heart} date={openDay} onClose={() => setOpenDay(null)} />
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
    // The actions wrap under the date on a narrow phone instead of squeezing it (a long «حال يومي» state).
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
      <div className="min-w-[11rem] flex-1">
        <h2 className="text-xl font-medium sm:text-2xl">{formatGregorian(today, locale, true)}</h2>
        {hijriDate || line ? <p className="text-sm leading-7 text-muted-foreground">{[hijriDate, line].filter(Boolean).join(' · ')}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DayStateMenu store={store} today={today} />
        <AddMenu store={store} today={today} habits={habits} />
      </div>
    </div>
  );
}

/** «مواعيد قادمة»: the next three periodic acts after today (reference side column), with «الكل». */
function Upcoming({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.todayTab');
  const { snapshot, today, planDays, habits } = context;
  const acts = useMemo(
    () =>
      periodicActsOnly(snapshot.store, today, planDays, habits)
        .filter((a) => a.next !== null && a.next > today)
        .sort((a, b) => ((a.next as string) < (b.next as string) ? -1 : 1))
        .slice(0, 3),
    [snapshot.store, today, planDays, habits],
  );
  if (acts.length === 0) return null;
  return (
    <section aria-labelledby="today-upcoming" className="flex flex-col gap-3">
      <TitleRow
        action={
          <Link href="/practice/periodic" className="text-link text-sm">
            {t('all')}
          </Link>
        }
      >
        <h2 id="today-upcoming" className="text-lg font-medium">
          {t('upcoming')}
        </h2>
      </TitleRow>
      <ul className="flex flex-col gap-3">
        {acts.map((act) => (
          <UpcomingRow key={`${act.kind}-${act.id}`} context={context} kind={act.kind} id={act.id} date={act.next as string} />
        ))}
      </ul>
    </section>
  );
}

function UpcomingRow({ context, kind, id, date }: { context: WirdContext; kind: 'relative' | 'habit'; id: string; date: string }) {
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { store } = context.snapshot;
  const plan = kind === 'habit' ? store.plans.find((p) => p.id === id) : undefined;
  const relative = kind === 'relative' ? store.relatives.find((r) => r.id === id) : undefined;
  const month = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(parseDate(date).year, parseDate(date).month - 1, 15)),
  );
  return (
    <li className="flex items-center gap-4">
      <span className="flex w-12 shrink-0 flex-col items-center leading-none">
        <span className="text-2xl font-medium tabular-nums">{formatDigits(parseDate(date).day)}</span>
        <span className="mt-1 text-xs text-muted-foreground">{month}</span>
      </span>
      <span className="min-w-0 flex-1 text-base break-words">{plan ? <PlanName plan={plan} context={context} /> : (relative?.name ?? null)}</span>
    </li>
  );
}

function PlanName({ plan, context }: { plan: WirdContext['snapshot']['store']['plans'][number]; context: WirdContext }) {
  const words = usePlanWords(plan, habitOf(plan, context.habits));
  return <span lang={words.titleLang}>{words.title}</span>;
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
      <Skeleton className="h-16 w-full" />
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
