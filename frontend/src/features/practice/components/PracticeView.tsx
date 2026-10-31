'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarPlus, Feather } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { loadWarning } from '@thekra/practice-core';
import { Link, useRouter } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { downloadTextFile, ICS_MIME } from '@/lib/practice/download';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf, isEbbDay, planReminderEvents, planRemindersIcs, planToday, ramadanEnd, setEbbForAll } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useEndedSeasons } from '../hooks/useEndedSeasons';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { useToday } from '../hooks/useToday';
import { SyncStatus } from './SyncStatus';
import { PlanCard } from './PlanCard';
import { PlanSetup } from './PlanSetup';
import { PracticeLoading } from './PracticeLoading';
import { ProgressPanel } from './ProgressPanel';
import { PushRemindersCard } from './PushRemindersCard';

/**
 * «طاعاتي»: setup, today's habits, in-app reminders, «وين وصلت», calendar file. `?add=1` (from «أضف» on the hub)
 * opens the setup at once, with `&habit=<key>` (a good-deed page's «ابدأ بها») already chosen; a `#plan-<id>` hash (a habit row on the hub) scrolls to that plan.
 */
export function PracticeView() {
  const t = useTranslations('practice.today');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const snapshot = usePracticeStore();
  const clock = useToday();
  const catalog = usePracticeCatalog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddRequested = searchParams.get('add') === '1';
  const requestedHabit = isAddRequested ? searchParams.get('habit') : null;
  const [adding, setAdding] = useState(isAddRequested);
  const today = clock?.today ?? null;
  const viewKey = !snapshot ? 'loading' : snapshot.store.plans.length === 0 || adding ? 'setup' : 'today';
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

  if (!snapshot || !clock || !today || !plans) return <PracticeLoading />;

  const hijriOffset = snapshot.store.settings.hijriOffset;
  const settingUp = plans.length === 0 || adding;

  function finishAdding() {
    setAdding(false);
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
          habits={catalog.data.habits}
          existing={plans}
          preselected={requestedHabit}
          freeMinutes={snapshot.store.settings.freeMinutesPerDay}
          today={today}
          onDone={finishAdding}
          onCancel={plans.length > 0 ? finishAdding : undefined}
        />
        {plans.length === 0 ? <PracticePaths /> : null}
      </div>
    );
  }

  const entries = plans.map((plan) => {
    const habit = habitOf(plan, habits);
    return { plan, habit, view: planToday(plan, today, clock.minutes, { fallback: habit?.defaultRule, hijriOffset }) };
  });
  const dueToday = entries.filter((entry) => entry.view.isDueToday);
  const notDueToday = entries.filter((entry) => !entry.view.isDueToday);
  // «يومي ثقيل» is one day (practice-core isEbbOn): an ebb from an earlier day is already over.
  const isEbb = isEbbDay(plans, today);
  const ramadanUntil = ramadanEnd(today, hijriOffset);
  const freeMinutes = snapshot.store.settings.freeMinutesPerDay;
  const overLoaded = freeMinutes !== undefined && loadWarning(plans, freeMinutes, today) === 'over';

  function toggleEbb() {
    updateStore((store) => setEbbForAll(store, !isEbb, today as string));
  }

  function handleReminders() {
    const events = planReminderEvents(plans as NonNullable<typeof plans>, habits, today as string, locale, hijriOffset);
    downloadTextFile('thekra-reminders.ics', planRemindersIcs(events, t('icsName')), ICS_MIME);
  }

  return (
    <div className="flex flex-col gap-10">
      <SyncStatus persistent={snapshot.persistent} />

      <div className="flex flex-col items-start gap-2">
        <button type="button" className="outline-button button-wrap" aria-pressed={isEbb} onClick={toggleEbb}>
          <Feather aria-hidden />
          {isEbb ? t('ebbOff') : t('ebbOn')}
        </button>
        <p className="text-sm leading-7 text-muted-foreground">{isEbb ? t('ebbActive') : t('ebbHint')}</p>
      </div>

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

      <div className="flex flex-wrap gap-3">
        <button type="button" className="solid-button button-wrap" onClick={() => setAdding(true)}>
          {t('add')} <DirectionalArrow />
        </button>
        <button type="button" className="outline-button button-wrap" onClick={handleReminders}>
          <CalendarPlus aria-hidden />
          {t('downloadReminders')}
        </button>
      </div>
      <p className="-mt-6 text-sm leading-7 text-muted-foreground">{t('remindersHint')}</p>
      <PushRemindersCard />

      <ProgressPanel entries={entries} today={today} />
      <PracticePaths />
    </div>
  );
}

/** The other practice pages, in the public «about-paths» style. */
export function PracticePaths() {
  const t = useTranslations('practice.paths');
  return (
    <nav className="about-paths" aria-label={t('label')}>
      <Link className="outline-button button-wrap" href="/practice">
        {t('hub')} <DirectionalArrow />
      </Link>
      <Link className="outline-button button-wrap" href="/practice/kinship">
        {t('kinship')} <DirectionalArrow />
      </Link>
      <Link className="outline-button button-wrap" href="/practice/leave-sin">
        {t('leaveSin')} <DirectionalArrow />
      </Link>
      <Link className="outline-button button-wrap" href="/calendar">
        {t('calendar')} <DirectionalArrow />
      </Link>
    </nav>
  );
}
