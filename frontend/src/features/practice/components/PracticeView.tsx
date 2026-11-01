'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { isEstablished, isPaused, limits, loadWarning, type LimitKind } from '@thekra/practice-core';
import { useRouter } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { downloadTextFile, ICS_MIME } from '@/lib/practice/download';
import { isPeriodicTemplate, limitOptions } from '@/lib/practice/limits';
import { habitOf, planReminderEvents, planRemindersIcs, planToday, ramadanEnd } from '@/lib/practice/plans';
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
import { currentPrayerLookup } from '@/lib/practice/screen-stores';
import { InfoTip } from '@/components/shared/InfoTip';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { useWirdContext } from '../hooks/useWirdContext';
import { GraduationOffers, MonthPanel, StreakLine } from './hub/HabitStats';
import { TallySection } from './hub/KnowledgeCards';

const HABITS_TABS = ['habits', 'month', 'progress'] as const;
type HabitsTab = (typeof HABITS_TABS)[number];
const isHabitsTab = (value: string | null): value is HabitsTab => (HABITS_TABS as readonly (string | null)[]).includes(value);

/**
 * «عاداتي» (owner, 2026-11-01: one page with what was «السجل»): the streak, then three tabs — «العادات» (today's habits,
 * add, pause, edit, calendar file), «الشهر» (the month calendar) and «التقدّم» (totals and «وين وصلت»). Setup replaces them. `?add=1` (from «أضف» on the hub)
 * opens the setup at once, with `&habit=<key>` (a good-deed page's «ابدأ بها») already chosen; a `#plan-<id>` hash (a habit row on the hub) scrolls to that plan.
 */
export function PracticeView() {
  const t = useTranslations('practice.today');
  const tRecord = useTranslations('practice.record');
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
  const viewKey = !snapshot ? 'loading' : snapshot.store.plans.length === 0 || adding || finishingFirst ? 'setup' : 'today';
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
  const settingUp = plans.length === 0 || finishingFirst || (adding && !limitReached);

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
          onCancel={plans.length > 0 ? finishAdding : undefined}
          onFirstPlan={() => setFinishingFirst(true)}
        />
      </div>
    );
  }

  const entries = plans.map((plan) => {
    const habit = habitOf(plan, habits);
    return { plan, habit, view: planToday(plan, today, clock.minutes, { fallback: habit?.defaultRule, hijriOffset, prayer: currentPrayerLookup()(today) }) };
  });
  // «عاداتي»: the saplings and periodic acts by today, then «عادات راسخة» and «موقوفة مؤقتًا» apart.
  const active = entries.filter((entry) => !isPaused(entry.plan) && !isEstablished(entry.plan));
  const established = entries.filter((entry) => !isPaused(entry.plan) && isEstablished(entry.plan));
  const paused = entries.filter((entry) => isPaused(entry.plan));
  const dueToday = active.filter((entry) => entry.view.isDueToday);
  const notDueToday = active.filter((entry) => !entry.view.isDueToday);
  const ramadanUntil = ramadanEnd(today, hijriOffset);
  const freeMinutes = snapshot.store.settings.freeMinutesPerDay;
  const overLoaded = freeMinutes !== undefined && loadWarning(plans, freeMinutes, today) === 'over';

  function handleReminders() {
    const events = planReminderEvents(plans as NonNullable<typeof plans>, habits, today as string, locale, hijriOffset);
    downloadTextFile('thekra-reminders.ics', planRemindersIcs(events, t('icsName')), ICS_MIME);
  }

  const visibleTab: HabitsTab = isHabitsTab(tab) ? tab : 'habits';

  return (
    <div className="flex flex-col gap-8">
      <SyncStatus persistent={snapshot.persistent} />
      <LimitSheet
        kind={addKind}
        open={limitReached}
        onOpenChange={(open) => (open ? undefined : finishAdding())}
        limits={planLimits}
        habits={habits}
        today={today}
        onFreed={() => undefined}
      />
      {wird ? <StreakLine context={wird} /> : null}

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

          <section aria-labelledby="today-title" className="flex flex-col gap-4">
            <h2 id="today-title" ref={todayRef} tabIndex={-1} className="text-2xl font-medium focus:outline-none">
              {t('title')}
            </h2>
            {dueToday.length === 0 ? <p className="text-muted-foreground">{t('noneDueToday')}</p> : null}
            {dueToday.map(({ plan, habit, view }) => (
              <PlanCard key={plan.id} plan={plan} habit={habit} view={view} today={today} ramadanUntil={ramadanUntil} />
            ))}
          </section>

          {notDueToday.length > 0 ? (
            <section aria-labelledby="not-due-title" className="flex flex-col gap-3">
              <h2 id="not-due-title" className="text-xl font-medium">
                {t('notDueTitle')}
              </h2>
              <p className="-mt-1 text-sm leading-7 text-muted-foreground">{t('notDueNote')}</p>
              {notDueToday.map(({ plan, habit, view }) => (
                <PlanCard key={plan.id} plan={plan} habit={habit} view={view} today={today} ramadanUntil={ramadanUntil} />
              ))}
            </section>
          ) : null}

          {established.length > 0 ? (
            <section aria-labelledby="established-title" className="flex flex-col gap-3">
              <h2 id="established-title" className="text-xl font-medium">
                {t('establishedTitle')}
              </h2>
              {established.map(({ plan, habit, view }) => (
                <PlanCard key={plan.id} plan={plan} habit={habit} view={view} today={today} ramadanUntil={ramadanUntil} />
              ))}
            </section>
          ) : null}

          {paused.length > 0 ? (
            <section aria-labelledby="paused-title" className="flex flex-col gap-3">
              <h2 id="paused-title" className="text-xl font-medium">
                {t('pausedTitle')}
              </h2>
              {paused.map(({ plan, habit, view }) => (
                <PlanCard key={plan.id} plan={plan} habit={habit} view={view} today={today} ramadanUntil={ramadanUntil} />
              ))}
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="solid-button button-wrap" onClick={() => setAdding(true)}>
              {t('add')} <DirectionalArrow />
            </button>
            <span className="inline-flex items-center gap-1">
              <button type="button" className="outline-button button-wrap" onClick={handleReminders}>
                <CalendarPlus aria-hidden />
                {t('downloadReminders')}
              </button>
              <InfoTip label={t('downloadReminders')}>{t('remindersHint')}</InfoTip>
            </span>
          </div>
          <NotificationsLink />
        </SegmentTabsContent>

        <SegmentTabsContent value="month">{wird ? <MonthPanel context={wird} /> : <PracticeLoading />}</SegmentTabsContent>

        <SegmentTabsContent value="progress" className="flex flex-col gap-10">
          {wird ? <TallySection store={wird.snapshot.store} today={today} habits={habits} /> : null}
          <ProgressPanel entries={entries} today={today} />
        </SegmentTabsContent>
      </SegmentTabs>
    </div>
  );
}
