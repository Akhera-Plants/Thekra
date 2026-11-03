'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarPlus, Lightbulb, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { activePrograms, isEstablished, isPaused, limits, loadWarning, type LimitKind } from '@thekra/practice-core';
import { Link, useRouter } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { downloadTextFile, ICS_MIME } from '@/lib/practice/download';
import { isPeriodicTemplate, limitOptions } from '@/lib/practice/limits';
import { habitOf, planReminderEvents, planRemindersIcs, planToday } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useEndedSeasons } from '../hooks/useEndedSeasons';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { useToday } from '../hooks/useToday';
import { SyncStatus } from './SyncStatus';
import { LimitSheet } from './LimitSheet';
import { PlanCard } from './PlanCard';
import { PlanSetup } from './PlanSetup';
import { PracticeLoading } from './PracticeLoading';
import { ProgressPanel } from './ProgressPanel';
import { NotificationsLink } from './NotificationsLink';
import { currentPrayerLookup, currentPrayerTimes } from '@/lib/practice/screen-stores';
import { InfoTip } from '@/components/shared/InfoTip';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { useWirdContext } from '../hooks/useWirdContext';
import { GraduationOffers, MonthPanel, StreakLine } from './hub/HabitStats';
import { TallySection } from './hub/KnowledgeCards';
import { HabitPrograms } from './HabitPrograms';

const HABITS_TABS = ['habits', 'month', 'progress'] as const;
type HabitsTab = (typeof HABITS_TABS)[number];
const isHabitsTab = (value: string | null): value is HabitsTab => (HABITS_TABS as readonly (string | null)[]).includes(value);

/**
 * «عاداتي» (owner, 2026-11-01: one page with what was «السجل», and it holds leaving sins too): the streak, then three
 * tabs — «العادات» («فعل الطاعات»: today's habits, add, calendar file; «ترك المعاصي»: the «تخفَّف» programs), «الشهر»
 * (the month calendar) and «التقدّم» (totals and «وين وصلت»). Setup replaces them while there is neither a habit nor a program. `?add=1` (from «أضف» on the hub)
 * opens the setup at once, with `&habit=<key>` (a good-deed page's «ابدأ بها») already chosen; a `#plan-<id>` hash (a habit row on the hub) scrolls to that plan.
 */
export function PracticeView() {
  const t = useTranslations('practice.today');
  const tRecord = useTranslations('practice.record');
  const tPeriodic = useTranslations('practice.periodic');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const snapshot = usePracticeStore();
  const clock = useToday();
  const catalog = usePracticeCatalog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddRequested = searchParams.get('add') === '1';
  const requestedHabit = isAddRequested ? searchParams.get('habit') : null;
  const [adding, setAdding] = useState(isAddRequested);
  // «العادات» · «الشهر» · «التقدّم»; `?tab=month` (or progress) opens another one first.
  const [tab, setTab] = useState<string | null>(() => searchParams.get('tab'));
  const wird = useWirdContext();
  // The first habit's setup stays open after the plan is saved, for its last screen (the two switches).
  const [finishingFirst, setFinishingFirst] = useState(false);
  const today = clock?.today ?? null;
  // Nothing yet (no habit, no program): the setup is the page. A program alone shows the page with an empty habits part.
  const isEmpty = snapshot ? snapshot.store.plans.length === 0 && activePrograms(snapshot.store.programs).length === 0 : false;
  const viewKey = !snapshot ? 'loading' : isEmpty || adding || finishingFirst ? 'setup' : 'today';
  const todayRef = useFocusOnChange<HTMLHeadingElement>(viewKey);
  const plans = snapshot?.store.plans;
  useEndedSeasons(plans, today);

  const arePlansShown = viewKey === 'today' && clock !== null;
  useEffect(() => {
    if (!arePlansShown) return;
    const target = window.location.hash.startsWith('#plan-') ? document.getElementById(window.location.hash.slice(1)) : null;
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }, [arePlansShown]);

  const habits = useMemo(
    () => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])),
    [catalog.data],
  );

  const planLimits = useMemo(
    () => (snapshot && today ? limits(snapshot.store, today, limitOptions(habits)) : null),
    [snapshot, today, habits],
  );

  if (!snapshot || !clock || !today || !plans || !planLimits) return <PracticeLoading />;

  const hijriOffset = snapshot.store.settings.hijriOffset;
  // A periodic template (from a good-deed page) falls under the periodic limit; any other habit is a sapling.
  const preselectedHabit = requestedHabit ? habits.get(requestedHabit) : undefined;
  const addKind: LimitKind = isPeriodicTemplate(preselectedHabit) ? 'periodic' : 'sapling';
  const limitReached = adding && plans.length > 0 && catalog.isSuccess && !planLimits.canAdd(addKind);
  const settingUp = isEmpty || finishingFirst || (adding && !limitReached);

  function finishAdding() {
    setAdding(false);
    setFinishingFirst(false);
    // Drop `?add=1`, so a reload shows the plans instead of the setup again.
    if (isAddRequested) router.replace('/practice/habits');
  }

  if (settingUp) {
    if (catalog.isPending) return <PracticeLoading />;
    if (catalog.isError) return <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;
    return (
      <div className="flex flex-col gap-6">
        <SyncStatus persistent={snapshot.persistent} />
        <PlanSetup
          habits={catalog.data.habits.filter((h) => !isPeriodicTemplate(h) || h.key === requestedHabit)}
          existing={plans}
          preselected={requestedHabit}
          freeMinutes={snapshot.store.settings.freeMinutesPerDay}
          today={today}
          onDone={finishAdding}
          onCancel={isEmpty ? undefined : finishAdding}
          onFirstPlan={() => setFinishingFirst(true)}
        />
      </div>
    );
  }

  const prayer = currentPrayerTimes(today);
  const entries = plans.map((plan) => {
    const habit = habitOf(plan, habits);
    return { plan, habit, view: planToday(plan, today, clock.minutes, { fallback: habit?.defaultRule, hijriOffset, prayer: currentPrayerLookup()(today) }) };
  });
  const card = ({ plan, habit, view }: (typeof entries)[number]) => (
    <PlanCard key={plan.id} plan={plan} habit={habit} view={view} today={today} hijriOffset={hijriOffset} prayer={prayer} />
  );
  // «عاداتي»: the saplings and periodic acts by today, then «عادات راسخة» and «موقوفة مؤقتًا» apart.
  // Periodic acts are reminders, never habits (owner round 3, item 6): their own group, after every habit group.
  const periodicEntries = entries.filter((entry) => isPeriodicTemplate(entry.habit) && !isPaused(entry.plan));
  const habitEntries = entries.filter((entry) => !periodicEntries.includes(entry));
  const active = habitEntries.filter((entry) => !isPaused(entry.plan) && !isEstablished(entry.plan));
  const established = habitEntries.filter((entry) => !isPaused(entry.plan) && isEstablished(entry.plan));
  const paused = habitEntries.filter((entry) => isPaused(entry.plan));
  const dueToday = active.filter((entry) => entry.view.isDueToday);
  const notDueToday = active.filter((entry) => !entry.view.isDueToday);
  const freeMinutes = snapshot.store.settings.freeMinutesPerDay;
  const overLoaded = freeMinutes !== undefined && loadWarning(plans, freeMinutes, today) === 'over';

  function handleReminders() {
    const events = planReminderEvents(plans as NonNullable<typeof plans>, habits, today as string, locale, hijriOffset);
    downloadTextFile('thekra-reminders.ics', planRemindersIcs(events, t('icsName')), ICS_MIME);
  }

  const visibleTab: HabitsTab = isHabitsTab(tab) ? tab : 'habits';

  return (
    <div className="flex flex-col gap-8">
      <LimitSheet
        kind={addKind}
        open={limitReached}
        onOpenChange={(open) => (open ? undefined : finishAdding())}
        limits={planLimits}
        store={snapshot.store}
        habits={habits}
        today={today}
        onFreed={() => undefined}
      />
      {wird ? <StreakLine context={wird} /> : null}
      <StrategiesEntry />

      <SegmentTabs
        aria-label={tRecord('tabsLabel')}
        items={HABITS_TABS.map((value) => ({ value, label: tRecord(`tabs.${value}`) }))}
        value={visibleTab}
        onValueChange={(value) => setTab(isHabitsTab(value) ? value : 'habits')}
        className="gap-8"
      >
        <SegmentTabsContent value="habits" className="flex flex-col gap-10">
          {wird ? <GraduationOffers context={wird} /> : null}
          {overLoaded ? <p className="next-step !mt-0">{t('loadOver')}</p> : null}
          {catalog.isError ? (
            <QueryErrorState
              error={catalog.error}
              onRetry={() => void catalog.refetch()}
              message={t('catalogError')}
              className="py-4"
            />
          ) : null}

          <section aria-labelledby="deeds-title" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="deeds-title" ref={todayRef} tabIndex={-1} className="text-2xl font-medium focus:outline-none">
                {t('deedsTitle')}
              </h2>
              <button type="button" className="outline-button" onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                {t('add')}
              </button>
            </div>

            {plans.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-muted-foreground md:p-5">{t('noHabits')}</p>
            ) : (
              <HabitGroup id="today-title" title={t('title')} empty={dueToday.length === 0 ? t('noneDueToday') : null}>
                {dueToday.map(card)}
              </HabitGroup>
            )}
            {notDueToday.length > 0 ? (
              <HabitGroup id="not-due-title" title={t('notDueTitle')} note={t('notDueNote')}>
                {notDueToday.map(card)}
              </HabitGroup>
            ) : null}
            {established.length > 0 ? (
              <HabitGroup id="established-title" title={t('establishedTitle')}>
                {established.map(card)}
              </HabitGroup>
            ) : null}
            {paused.length > 0 ? (
              <HabitGroup id="paused-title" title={t('pausedTitle')}>
                {paused.map(card)}
              </HabitGroup>
            ) : null}
            {periodicEntries.length > 0 ? (
              <HabitGroup id="periodic-title" title={tPeriodic('title')} note={tPeriodic('remindersOnly')}>
                {periodicEntries.map(card)}
              </HabitGroup>
            ) : null}
          </section>

          <SectionDivider />

          <HabitPrograms store={snapshot.store} today={today} catalog={catalog.data} />

          <SectionDivider />

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <button type="button" className="outline-button button-wrap" onClick={handleReminders}>
                <CalendarPlus aria-hidden />
                {t('downloadReminders')}
              </button>
              <InfoTip label={t('downloadReminders')}>{t('remindersHint')}</InfoTip>
            </span>
            <NotificationsLink />
          </div>
        </SegmentTabsContent>

        <SegmentTabsContent value="month">{wird ? <MonthPanel context={wird} /> : <PracticeLoading />}</SegmentTabsContent>

        <SegmentTabsContent value="progress" className="flex flex-col gap-10">
          {wird ? <TallySection store={wird.snapshot.store} today={today} habits={habits} /> : null}
          <SectionDivider />
          <ProgressPanel entries={habitEntries} today={today} />
        </SegmentTabsContent>
      </SegmentTabs>
      {/* Where the data lives: one quiet line under the page (the account link is in «الإعدادات»). */}
      <SyncStatus persistent={snapshot.persistent} quiet />
    </div>
  );
}

/** «استراتيجيات العادات» near the top of «عاداتي» (owner round 4: easy to find; it stays in the menu too). */
function StrategiesEntry() {
  const t = useTranslations('practice.strategies');
  return (
    <Link
      href="/practice/strategies"
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <Lightbulb aria-hidden className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-medium">{t('title')}</span>
        <span className="text-sm leading-6 text-muted-foreground">{t('lead')}</span>
      </span>
      <DirectionalArrow className="size-5 text-primary" />
    </Link>
  );
}

interface HabitGroupProps {
  id: string;
  title: string;
  note?: string;
  empty?: string | null;
  children: React.ReactNode;
}

/** One group of «فعل الطاعات» («اليوم», «ليست مطلوبة اليوم», «عادات راسخة», «موقوفة مؤقتًا»). */
function HabitGroup({ id, title, note, empty, children }: HabitGroupProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-lg font-medium text-muted-foreground">
        {title}
      </h3>
      {note ? <p className="-mt-2 text-sm leading-7 text-muted-foreground">{note}</p> : null}
      {empty ? <p className="text-muted-foreground">{empty}</p> : null}
      {children}
    </section>
  );
}
