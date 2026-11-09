'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, DEFAULT_REVIEW_DAY, parseDate, weekday, weekStart, weekStrip, type HeartData, type WeekStripDay } from '@thekra/practice-core';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { limitOptions } from '@/lib/practice/limits';
import { cn } from '@/lib/utils';
import type { WirdContext } from '../../hooks/useWirdContext';

/**
 * The week strip at the top of «اليوم» (round 6 §2, C-01r / C-02a, reference): seven days from the member's review day
 * (Friday by default: the weekly review and the next week's plan). Each day shows its number and a quiet mark — kept,
 * part kept, «لم تتم» (a hollow ring, never red), excused — and today is framed. A past day opens its details (and
 * «هل فعلتها؟» while it can still be answered); future days are shown, never logged. The previous weeks can be
 * browsed; the week after this one is not (nothing to see there yet).
 */
export function WeekStrip({ context, heart, onOpenDay }: { context: WirdContext; heart: HeartData | null; onOpenDay: (date: string) => void }) {
  const t = useTranslations('practice.weekStrip');
  const tDays = useTranslations('practice.weekdaysShort');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { snapshot, today, habits, planDays } = context;
  const reviewDay = heart?.prefs.reviewDay ?? DEFAULT_REVIEW_DAY;
  const [offset, setOffset] = useState(0);
  const anchor = addDays(weekStart(today, reviewDay), offset * 7);
  const days = useMemo(
    () => weekStrip(snapshot.store, anchor, today, { ...planDays, reviewDay, isPeriodicAct: limitOptions(habits).isPeriodicAct }),
    [snapshot.store, anchor, today, planDays, reviewDay, habits],
  );
  const range = `${formatGregorian(days[0].date, locale)} – ${formatGregorian(days[6].date, locale)}`;

  return (
    <section aria-label={t('label')} className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          aria-label={t('previous')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {/* Back in reading order: left in English, mirrored (right) in Arabic. */}
          <ChevronLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </button>
        <ol className="grid min-w-0 flex-1 grid-cols-7 gap-1">
          {days.map((day) => (
            <li key={day.date} className="min-w-0">
              <DayCell day={day} label={tDays(`d${weekday(day.date)}`)} today={today} onOpen={onOpenDay} />
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          aria-label={t('next')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-5 rtl:-scale-x-100" />
        </button>
      </div>
      <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs leading-6 text-muted-foreground">
        <span className="sr-only">{range}</span>
        <span aria-hidden>{offset === 0 ? t('thisWeek') : range}</span>
        <span className="flex flex-wrap items-center gap-x-3" aria-hidden>
          <Legend kind="done" label={t('legend.done')} />
          <Legend kind="partial" label={t('legend.partial')} />
          <Legend kind="notDone" label={t('legend.notDone')} />
        </span>
      </p>
    </section>
  );
}

function Mark({ status }: { status: WeekStripDay['status'] }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block size-2 rounded-full',
        status === 'done' && 'bg-primary',
        status === 'partial' && 'bg-[linear-gradient(to_top,var(--primary)_50%,transparent_50%)] ring-1 ring-primary',
        status === 'notDone' && 'ring-1 ring-muted-foreground/60',
        status === 'excused' && 'bg-muted-foreground/40',
        (status === 'open' || status === 'empty' || status === 'future') && 'bg-transparent',
      )}
    />
  );
}

function Legend({ kind, label }: { kind: WeekStripDay['status']; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Mark status={kind} />
      {label}
    </span>
  );
}

function DayCell({ day, label, today, onOpen }: { day: WeekStripDay; label: string; today: string; onOpen: (date: string) => void }) {
  const t = useTranslations('practice.weekStrip');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const n = formatDigits(parseDate(day.date).day);
  const statusWord = t(`status.${day.status}`);
  const name = `${formatGregorian(day.date, locale, true)}: ${statusWord}`;
  const body = (
    <>
      <span className="text-xs leading-5 text-muted-foreground">{label}</span>
      <span className={cn('text-lg leading-7 tabular-nums sm:text-xl', day.isToday && 'font-semibold text-primary-text')}>{n}</span>
      <Mark status={day.status} />
    </>
  );
  const shell = cn(
    'flex min-h-[4.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5',
    day.isToday ? 'border-primary/40 bg-secondary' : 'border-transparent',
  );
  if (day.date > today) {
    return (
      <div className={cn(shell, 'text-muted-foreground')} aria-label={name} title={t('future')}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={name}
      aria-current={day.isToday ? 'date' : undefined}
      onClick={() => onOpen(day.date)}
      className={cn(shell, 'transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring')}
    >
      {body}
    </button>
  );
}
