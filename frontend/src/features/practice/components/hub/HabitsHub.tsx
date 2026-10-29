'use client';

import { useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { dayAgenda, intendedPlan, presence, type DayPresence } from '@thekra/practice-core';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { isFirstRun, trackSummary, weekOf, weekStartFor } from '@/lib/practice/hub';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeSnapshot } from '@/lib/practice/local-store';
import type { PracticeHabit, ScheduleBasis } from '@/lib/types/practice';
import { useDaySelection, type DaySelection } from '../../hooks/useDaySelection';
import { useEndedSeasons } from '../../hooks/useEndedSeasons';
import { usePracticeCatalog } from '../../hooks/usePracticeCatalog';
import { usePracticeStore } from '../../hooks/usePracticeStore';
import { useTazkiyaJournal } from '../../hooks/useTazkiyaJournal';
import { useToday } from '../../hooks/useToday';
import { SyncStatus } from '../SyncStatus';
import { DayAgenda } from './DayAgenda';
import { HubHeader } from './HubHeader';
import { HubMonth } from './HubMonth';
import { FreshStartSlot, NotebookLink, TazkiyaPromptSlot } from './TazkiyaSlots';
import { StartChoices, TrackLinks } from './TrackLinks';
import { WeekStrip } from './WeekStrip';

/**
 * «عاداتي»: the day first. Tazkiya (proposals items 5–7): the morning intention or the evening reckoning on top, a
 * fresh-start card under today's list, «دفتر المحاسبة» (this browser only), a short supplication after a tick. One selected day drives the header date, the week strip, the day's list across every
 * track and the month; the tracks lead to their own pages. Everything is read from the device store.
 */
export function HabitsHub() {
  const snapshot = usePracticeStore();
  const clock = useToday();
  const today = clock?.today ?? null;
  const selection = useDaySelection(today);
  useEndedSeasons(snapshot?.store.plans, today);

  return (
    <>
      <HubHeader date={snapshot ? (selection?.selected ?? null) : null} hijriOffset={snapshot?.store.settings.hijriOffset ?? 0} />
      {snapshot && selection && today ? <HubBody snapshot={snapshot} today={today} selection={selection} /> : <HubSkeleton />}
    </>
  );
}

interface HubBodyProps {
  snapshot: PracticeSnapshot;
  today: string;
  selection: DaySelection;
}

function HubBody({ snapshot, today, selection }: HubBodyProps) {
  const t = useTranslations('practice.today');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const catalog = usePracticeCatalog();
  const dayRef = useRef<HTMLHeadingElement>(null);
  const { store } = snapshot;
  const { selected } = selection;
  const hijriOffset = store.settings.hijriOffset;
  const occasions = catalog.data?.occasions;

  const habits = useMemo(
    () => new Map<string, PracticeHabit>((catalog.data?.habits ?? []).map((h) => [h.key, h])),
    [catalog.data],
  );
  const occasionBasis = useMemo(
    () => new Map<string, ScheduleBasis>((occasions ?? []).map((o) => [o.key, o.basis])),
    [occasions],
  );
  const items = useMemo(() => dayAgenda(store, selected, { occasions, hijriOffset }), [store, selected, occasions, hijriOffset]);
  const week = weekOf(selected, weekStartFor(locale));
  const weekFrom = week[0] as string;
  const weekTo = week[6] as string;
  const weekPresence = useMemo(
    () => new Map<string, DayPresence>(presence(store, weekFrom, weekTo).map((day) => [day.date, day])),
    [store, weekFrom, weekTo],
  );
  const summary = useMemo(() => trackSummary(store, today), [store, today]);
  const firstRun = isFirstRun(store);
  const journal = useTazkiyaJournal();
  const tazkiya = catalog.data?.tazkiya;
  const isToday = selected === today;
  const choices = useMemo(
    () =>
      items.flatMap((item) => {
        if (item.kind !== 'habit') return [];
        const plan = store.plans.find((p) => p.id === item.planId);
        if (!plan) return [];
        const habit = habitOf(plan, habits);
        return [{ planId: plan.id, title: habit ? (locale === 'en' ? habit.titleEn : habit.titleAr) : plan.title }];
      }),
    [items, store.plans, habits, locale],
  );

  function handleGridSelect(date: string) {
    selection.select(date);
    const heading = dayRef.current;
    if (!heading) return;
    const { top } = heading.getBoundingClientRect();
    if (top >= 0 && top <= window.innerHeight * 0.6) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="flex flex-col gap-10">
      {catalog.isError ? (
        <QueryErrorState error={catalog.error} onRetry={() => void catalog.refetch()} message={t('catalogError')} className="py-4" />
      ) : null}
      {firstRun ? <StartChoices /> : null}
      {isToday ? <TazkiyaPromptSlot prompts={tazkiya} choices={choices} isStarted={!firstRun} /> : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start lg:gap-14">
        <div className="flex min-w-0 flex-col gap-6">
          <WeekStrip
            selected={selected}
            today={today}
            presence={weekPresence}
            onSelect={selection.select}
            onShiftWeek={selection.shiftWeek}
          />
          <DayAgenda
            items={items}
            store={store}
            date={selected}
            today={today}
            habits={habits}
            occasionBasis={occasionBasis}
            headingRef={dayRef}
            intendedPlanId={journal ? intendedPlan(journal, selected) : null}
          />
          {isToday ? (
            <FreshStartSlot prompts={tazkiya} today={today} hijriOffset={hijriOffset} plans={store.plans} choices={choices} />
          ) : null}
          {firstRun ? null : <NotebookLink />}
        </div>
        <div className="flex min-w-0 flex-col gap-10">
          {firstRun ? null : <TrackLinks summary={summary} />}
          <HubMonth
            store={store}
            today={today}
            selected={selected}
            month={selection.month}
            occasions={occasions}
            summary={summary}
            onSelect={handleGridSelect}
            onMonthChange={selection.showMonth}
          />
        </div>
      </div>

      <SyncStatus persistent={snapshot.persistent} quiet />
    </div>
  );
}

const SKELETON_DAYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
const SKELETON_ROWS = ['r1', 'r2', 'r3', 'r4'];

/** The device store does not exist during the server render: the hub's shape, without numbers. */
function HubSkeleton() {
  const t = useTranslations('feedback');
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only" role="status">
        {t('loading')}
      </span>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {SKELETON_DAYS.map((key) => (
          <Skeleton key={key} className="h-[4.5rem] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-28" />
      <div className="flex flex-col gap-4">
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
    </div>
  );
}
