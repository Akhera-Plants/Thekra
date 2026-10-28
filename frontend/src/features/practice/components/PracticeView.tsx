'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarPlus, Feather } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { endEbb, loadWarning, normalize, startEbb, updatePlan } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { downloadTextFile, ICS_MIME } from '@/lib/practice/download';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf, planReminderEvents, planRemindersIcs, planToday, ramadanEnd } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePracticeCatalog } from '../hooks/usePracticeCatalog';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { useToday } from '../hooks/useToday';
import { SyncStatus } from './SyncStatus';
import { PlanCard, usePlanWords } from './PlanCard';
import { PlanSetup } from './PlanSetup';
import { PracticeLoading } from './PracticeLoading';
import { ProgressPanel } from './ProgressPanel';

/** «أعِنّي على طاعة»: setup, today's habits, in-app reminders, «وين وصلت», calendar file. */
export function PracticeView() {
  const t = useTranslations('practice.today');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const snapshot = usePracticeStore();
  const clock = useToday();
  const catalog = usePracticeCatalog();
  const [adding, setAdding] = useState(false);
  const today = clock?.today ?? null;
  const viewKey = !snapshot ? 'loading' : snapshot.store.plans.length === 0 || adding ? 'setup' : 'today';
  const todayRef = useFocusOnChange<HTMLHeadingElement>(viewKey);

  // A season that has ended returns the plan to its everyday amount, with no penalty (practice-core normalize).
  // Deliberately not through updatePlan: the end is derived from the date, so it is not a new edit (no updatedAt).
  const plans = snapshot?.store.plans;
  useEffect(() => {
    if (!today || !plans?.some((plan) => plan.season && today > plan.season.until)) return;
    updateStore((store) => ({ ...store, plans: store.plans.map((plan) => normalize(plan, today)) }));
  }, [plans, today]);

  const habits = useMemo(
    () => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])),
    [catalog.data],
  );

  if (!snapshot || !clock || !today || !plans) return <PracticeLoading />;

  const hijriOffset = snapshot.store.settings.hijriOffset;
  const settingUp = plans.length === 0 || adding;

  if (settingUp) {
    if (catalog.isPending) return <PracticeLoading />;
    if (catalog.isError) return <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;
    return (
      <div className="flex flex-col gap-6">
        <SyncStatus persistent={snapshot.persistent} />
        <PlanSetup
          habits={catalog.data.habits}
          existing={plans}
          freeMinutes={snapshot.store.settings.freeMinutesPerDay}
          today={today}
          onDone={() => setAdding(false)}
          onCancel={plans.length > 0 ? () => setAdding(false) : undefined}
        />
        {plans.length === 0 ? <PracticePaths /> : null}
      </div>
    );
  }

  const entries = plans.map((plan) => ({ plan, habit: habitOf(plan, habits), view: planToday(plan, today, clock.minutes) }));
  const due = entries.filter((entry) => entry.view.isDue);
  const isEbb = plans.some((plan) => plan.ebb);
  const ramadanUntil = ramadanEnd(today, hijriOffset);
  const freeMinutes = snapshot.store.settings.freeMinutesPerDay;
  const overLoaded = freeMinutes !== undefined && loadWarning(plans, freeMinutes, today) === 'over';

  function toggleEbb() {
    updateStore((store) =>
      store.plans.reduce(
        (next, plan) => updatePlan(next, plan.id, (p) => (isEbb ? endEbb(p) : startEbb(p, today as string))),
        store,
      ),
    );
  }

  function handleReminders() {
    const events = planReminderEvents(plans as NonNullable<typeof plans>, habits, today as string, locale, hijriOffset);
    downloadTextFile('thekra-reminders.ics', planRemindersIcs(events, t('icsName')), ICS_MIME);
  }

  return (
    <div className="flex flex-col gap-10">
      <SyncStatus persistent={snapshot.persistent} />

      {due.length > 0 ? (
        <section className="next-step !mt-0 flex flex-col gap-2" aria-labelledby="due-title" role="status">
          <strong id="due-title" className="inline-flex items-center gap-2">
            <BellRing className="size-4" aria-hidden />
            {t('dueTitle')}
          </strong>
          <ul className="flex flex-col gap-1">
            {due.map((entry) => (
              <DueItem key={entry.plan.id} entry={entry} />
            ))}
          </ul>
        </section>
      ) : null}

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
        {entries.map(({ plan, habit, view }) => (
          <PlanCard key={plan.id} plan={plan} habit={habit} view={view} today={today} ramadanUntil={ramadanUntil} />
        ))}
      </section>

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

      <ProgressPanel entries={entries} today={today} />
      <PracticePaths />
    </div>
  );
}

function DueItem({
  entry,
}: {
  entry: { plan: Parameters<typeof usePlanWords>[0]; habit: PracticeHabit | undefined; view: { remaining: number } };
}) {
  const t = useTranslations('practice.today');
  const words = usePlanWords(entry.plan, entry.habit);
  return (
    <li>
      <span lang={words.titleLang}>{words.title}</span>: {t('remaining', { amount: words.amount(entry.view.remaining) })}
    </li>
  );
}

/** The other practice pages, in the public «about-paths» style. */
export function PracticePaths() {
  const t = useTranslations('practice.paths');
  return (
    <nav className="about-paths" aria-label={t('label')}>
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
