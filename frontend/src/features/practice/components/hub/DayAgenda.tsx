'use client';

import { useId, type Ref } from 'react';
import { Feather } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, weekday, type AgendaItem, type Store } from '@thekra/practice-core';
import { formatGregorian } from '@/lib/practice/format';
import { canLogOn, isDayComplete } from '@/lib/practice/hub';
import { habitOf, setEbbForAll } from '@/lib/practice/plans';
import { updateStore } from '@/lib/practice/local-store';
import type { PracticeHabit, ScheduleBasis } from '@/lib/types/practice';
import { useAgendaActions } from '../../hooks/useAgendaActions';
import { useCelebration } from '../../hooks/useCelebration';
import { HabitRow, OccasionRow, ProgramRow, RelativeRow } from './AgendaRows';

interface DayAgendaProps {
  items: readonly AgendaItem[];
  store: Store;
  date: string;
  today: string;
  habits: ReadonlyMap<string, PracticeHabit>;
  occasionBasis: ReadonlyMap<string, ScheduleBasis>;
  headingRef?: Ref<HTMLHeadingElement>;
  /** The plan chosen in «نيّتي اليوم» for this day. */
  intendedPlanId?: string | null;
}

/**
 * The selected day across every track, in the engine's order, with round checks for what can be done. A habit's tick
 * shows the catalog's short supplication under its row for a moment, announced politely; nothing else celebrates.
 */
export function DayAgenda({ items, store, date, today, habits, occasionBasis, headingRef, intendedPlanId }: DayAgendaProps) {
  const t = useTranslations('practice.hub.day');
  const tDays = useTranslations('practice.weekdays');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const noteId = useId();
  const { lastKey, lastCleared, toggleHabit, toggleRelative, undoLast } = useAgendaActions();
  const { celebration, celebrate } = useCelebration();
  const isLoggable = canLogOn(date, today);
  const isToday = date === today;
  const title =
    isToday
      ? t('today')
      : date === addDays(today, -1)
        ? t('yesterday')
        : date === addDays(today, 1)
          ? t('tomorrow')
          : t('dayTitle', { weekday: tDays(`d${weekday(date)}`), date: formatGregorian(date, locale) });
  const hasTasks = items.some((item) => item.kind !== 'occasion');

  return (
    <section aria-labelledby="hub-day-title" className="flex flex-col gap-2">
      <h2 id="hub-day-title" ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-2xl font-medium focus:outline-none">
        {title}
      </h2>
      {hasTasks && !isLoggable ? (
        <p id={noteId} className="text-sm leading-7 text-muted-foreground">
          {date > today ? t('future') : t('tooOld')}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="py-4 text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border" aria-label={t('listLabel')}>
          {items.map((item) => {
            switch (item.kind) {
              case 'occasion':
                return <OccasionRow key={`occasion-${item.key}`} item={item} basis={occasionBasis.get(item.key)} />;
              case 'habit': {
                const plan = store.plans.find((p) => p.id === item.planId);
                if (!plan) return null;
                return (
                  <HabitRow
                    key={`habit-${item.planId}`}
                    item={item}
                    plan={plan}
                    habit={habitOf(plan, habits)}
                    isEnabled={isLoggable}
                    disabledNoteId={noteId}
                    undo={lastKey === `habit:${item.planId}:${date}` ? (lastCleared ? 'cleared' : 'logged') : null}
                    isIntended={item.planId === intendedPlanId}
                    celebration={celebration?.key === `${item.planId}|${date}` ? celebration.line : undefined}
                    onToggle={() => {
                      toggleHabit(item, date);
                      if (!item.complete) celebrate(`${item.planId}|${date}`);
                    }}
                    onUndo={undoLast}
                  />
                );
              }
              case 'relative': {
                const relative = store.relatives.find((r) => r.id === item.relativeId);
                if (!relative) return null;
                return (
                  <RelativeRow
                    key={`relative-${item.relativeId}`}
                    item={item}
                    relative={relative}
                    isEnabled={isLoggable}
                    disabledNoteId={noteId}
                    undo={lastKey === `relative:${item.relativeId}:${date}` ? (lastCleared ? 'cleared' : 'logged') : null}
                    onToggle={() => toggleRelative(item, date)}
                    onUndo={undoLast}
                  />
                );
              }
              case 'program':
                return <ProgramRow key="program" item={item} isToday={isToday} />;
            }
          })}
        </ul>
      )}

      <p role="status" className="min-h-0 text-base leading-8 text-primary empty:hidden">
        {isDayComplete(items) ? (isToday ? t('complete') : t('completePast')) : null}
      </p>
      <p role="status" className="sr-only">
        {lastKey ? (lastCleared ? t('unlogged') : (celebration?.line ?? t('logged'))) : null}
      </p>

      {store.plans.length > 0 ? <EbbToggle store={store} today={today} /> : null}
    </section>
  );
}

/** «يومي ثقيل»: every plan asks only its token amount until it is turned off (practice-core ebb). */
function EbbToggle({ store, today }: { store: Store; today: string }) {
  const t = useTranslations('practice.today');
  const isEbb = store.plans.some((plan) => plan.ebb);
  return (
    <div className="mt-4 flex flex-col items-start gap-1">
      <button
        type="button"
        className="outline-button button-wrap !min-h-11"
        aria-pressed={isEbb}
        onClick={() => updateStore((s) => setEbbForAll(s, !isEbb, today))}
      >
        <Feather aria-hidden />
        {isEbb ? t('ebbOff') : t('ebbOn')}
      </button>
      <p className="text-sm leading-7 text-muted-foreground">{isEbb ? t('ebbActive') : t('ebbHint')}</p>
    </div>
  );
}
