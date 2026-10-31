'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { canMakeUp, logMinimum, minimumMet, minimumToLog, updatePlan, type HabitItem, type Store } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { formatDigits } from '@/lib/format/digits';
import { canLogOn } from '@/lib/practice/hub';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import type { TaskItem, WirdDay } from '@/lib/practice/wird';
import type { PracticeHabit, ScheduleBasis } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { useAgendaActions } from '../../hooks/useAgendaActions';
import { HabitRow, OccasionLine, ProgramRow, RelativeRow } from './AgendaRows';
import { Cheer, StoryLine } from './KnowledgeCards';

interface TodayListProps {
  /** «اليوم», or the title of a day picked in «سجلّي». */
  title: string;
  store: Store;
  date: string;
  today: string;
  day: WirdDay;
  habits: ReadonlyMap<string, PracticeHabit>;
  occasionBasis: ReadonlyMap<string, ScheduleBasis>;
  /** «أضف عادة» under the empty line (on «ورد اليوم» only). */
  canAdd?: boolean;
  /** Under the list (the «يومي ثقيل» toggle). */
  footer?: ReactNode;
  /** Replaces the «تمّ ما في يومك» line on «ورد اليوم» (the «تمّ وردك اليوم» card with its reward text). */
  completeCard?: ReactNode;
}

/**
 * A day's list: «اليوم» on «ورد اليوم», or a day picked in «سجلّي». The day's sunnah occasion as one compact line, then
 * one row per task (habits asked that day, relatives due, the generic private check-in) with a round tick and an
 * inline undo; done rows sink to the bottom, dimmed. Habits the day does not ask for sit behind ONE collapsed row
 * «ليست مطلوبة اليوم (n)», still loggable and never counted as missed. Logging works for today and the 6 days before.
 */
export function TodayList({ title, store, date, today, day, habits, occasionBasis, canAdd = false, footer, completeCard }: TodayListProps) {
  const t = useTranslations('practice.wird');
  const tDay = useTranslations('practice.hub.day');
  const headingId = useId();
  const noteId = useId();
  const offDayId = useId();
  const [offDayOpen, setOffDayOpen] = useState(false);
  const [cheerAt, setCheerAt] = useState<number | null>(null);
  const { lastKey, lastCleared, toggleHabit, toggleRelative, undoLast } = useAgendaActions();
  const isLoggable = canLogOn(date, today);
  const isToday = date === today;
  const tasks = [...day.open, ...day.done];
  const isComplete = tasks.length > 0 && day.open.length === 0;

  const undoOf = (key: string) => (lastKey === key ? (lastCleared ? 'cleared' : 'logged') : null);

  function habitRow(item: HabitItem) {
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
        undo={undoOf(`habit:${item.planId}:${date}`)}
        onToggle={() => {
          toggleHabit(item, date, today);
          // «تقبّل الله منك» after a tick (not an untick).
          if (!item.complete) setCheerAt(Date.now());
        }}
        onUndo={undoLast}
        minimumMet={minimumMet(plan, date)}
        onMinimum={
          !item.complete && minimumToLog(plan, date) !== null
            ? () => {
                updateStore((s) => updatePlan(s, plan.id, (p) => logMinimum(p, date, today)));
                setCheerAt(Date.now());
              }
            : undefined
        }
      />
    );
  }

  function taskRow(item: TaskItem) {
    switch (item.kind) {
      case 'habit':
        return habitRow(item);
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
            undo={undoOf(`relative:${item.relativeId}:${date}`)}
            onToggle={() => toggleRelative(item, date)}
            onUndo={undoLast}
          />
        );
      }
      case 'program':
        return <ProgramRow key="program" item={item} isToday={isToday} />;
    }
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} tabIndex={-1} className="scroll-mt-24 text-2xl font-medium focus:outline-none">
        {title}
      </h2>

      {!isLoggable && (tasks.length > 0 || day.offDay.length > 0) ? (
        <p id={noteId} className="text-sm leading-7 text-muted-foreground">
          {date > today ? tDay('future') : tDay('tooOld')}
        </p>
      ) : isLoggable && !canMakeUp(date, today) && (tasks.length > 0 || day.offDay.length > 0) ? (
        <p className="text-sm leading-7 text-muted-foreground">{tDay('afterMakeUp')}</p>
      ) : null}

      {day.occasions.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {day.occasions.map((item) => (
            <OccasionLine key={`occasion-${item.key}`} item={item} basis={occasionBasis.get(item.key)} />
          ))}
        </ul>
      ) : null}

      {tasks.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border border-y border-border" aria-label={title}>
          {day.open.map(taskRow)}
          {day.done.map(taskRow)}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-1">
          <p className="text-muted-foreground">{isToday ? t('empty') : tDay('empty')}</p>
          {canAdd ? (
            <Link href={{ pathname: '/practice/habits', query: { add: '1' } }} className="text-link">
              {t('addHabit')}
            </Link>
          ) : null}
        </div>
      )}

      {day.offDay.length > 0 ? (
        <div className="flex flex-col">
          <button
            type="button"
            aria-expanded={offDayOpen}
            aria-controls={offDayId}
            onClick={() => setOffDayOpen((open) => !open)}
            className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-start text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex-1">
              {t(isToday ? 'notDueToday' : 'notDueDay', { n: formatDigits(day.offDay.length) })}
            </span>
            <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-150', offDayOpen && 'rotate-180')} />
          </button>
          <ul id={offDayId} hidden={!offDayOpen} className="flex flex-col divide-y divide-border border-y border-border">
            {day.offDay.map(habitRow)}
          </ul>
        </div>
      ) : null}

      {isComplete && isToday && completeCard ? (
        completeCard
      ) : (
        <p role="status" className="text-base leading-8 text-primary empty:hidden">
          {isComplete ? (isToday ? tDay('complete') : tDay('completePast')) : null}
        </p>
      )}
      {isToday && !isComplete ? <Cheer at={cheerAt} /> : null}
      {/* A small-deed nudge once «أقل ما يمكن» kept a habit today. */}
      {isToday && store.plans.some((plan) => minimumMet(plan, date)) ? <StoryLine moment="smallDeed" /> : null}
      <p role="status" className="sr-only">
        {lastKey ? (lastCleared ? tDay('unlogged') : tDay('logged')) : null}
      </p>

      {footer}
    </section>
  );
}
