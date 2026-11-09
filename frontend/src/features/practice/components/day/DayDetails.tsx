'use client';

import { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  addDays,
  answerDidIt,
  answerDidNot,
  countsAsNotDone,
  dayDetails,
  dayLogState,
  diffDays,
  eveningOf,
  FARD_LABELS,
  FARD_PRAYERS,
  programDayDetails,
  reflectionsOfPlan,
  relapseSuggestionFor,
  updatePlan,
  type DayLogState,
  type HabitDayDetail,
  type HeartData,
  type Plan,
  type Reflection,
  type SinProgram,
  type Store,
  type WeeklyReview,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import { useSinNames } from '../../hooks/useSinNames';
import type { WirdContext } from '../../hooks/useWirdContext';
import { CoveredGate } from '../lighten/CoveredGate';
import { usePlanWords } from '../plan-words';
import { cn } from '@/lib/utils';

/** The weekly review that covers `date` (the week of seven days ending on its review day), if saved. */
export function weeklyReviewFor(heart: HeartData, date: string): WeeklyReview | undefined {
  return heart.weekly.find((w) => w.weekOf >= date && diffDays(date, w.weekOf) <= 6);
}

/** The words of a day's state for one habit (calm: «لم تتم», never «فاتتك»). */
export function useDayLogWord() {
  const t = useTranslations('practice.dayDetails.state');
  return (state: DayLogState) => t(state);
}

interface DayDetailsProps {
  context: WirdContext;
  heart: HeartData | null;
  date: string;
  /** Hides the heading (the dialog has its own title). */
  bare?: boolean;
}

/**
 * One day of «سجلّي» / the week strip (round 6 §2/§4, C-01j, C-02d, C-27): each habit's state, amount and the two
 * answers + note written that day; a past day without a log still asks «هل فعلتها؟» (فعلتها / لم أفعل) inside the
 * window; «الفرائض» marks and «قضاء» made up; the «تخفَّف» part only once the programs are open (covered by default).
 * A slipped day offers the review of its week, or shows the saved one, with «تعلّم من الخطأ».
 */
export function DayDetailsPanel({ context, heart, date, bare = false }: DayDetailsProps) {
  const t = useTranslations('practice.dayDetails');
  const tState = useTranslations('practice.dayState.states');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { snapshot, today, planDays } = context;
  const { store } = snapshot;
  const details = useMemo(() => dayDetails(store, date, today, planDays), [store, date, today, planDays]);
  const rows = details.habits.filter((h) => (h.state !== 'notAsked' && h.state !== 'archived') || h.done > 0);
  const slipped = rows.filter((h) => countsAsNotDone(h.state));
  const fardMarked = FARD_PRAYERS.filter((p) => details.fard[p] !== null);
  const labels = FARD_LABELS[locale];
  const review = heart ? weeklyReviewFor(heart, date) : undefined;
  const evening = heart ? eveningOf(heart, date) : undefined;

  return (
    <div className="flex flex-col gap-5">
      {bare ? null : <h3 className="text-xl font-medium">{formatGregorian(date, locale, true)}</h3>}
      {details.dayState.state !== 'normal' ? (
        <p className="text-sm leading-7 text-muted-foreground">
          {t('dayState', { state: details.dayState.legacy && details.dayState.state === 'sick' ? tState('legacySick') : tState(details.dayState.state) })}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm leading-7 text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {rows.map((row) => {
            const plan = store.plans.find((p) => p.id === row.planId);
            return plan ? <HabitDayRow key={row.planId} row={row} plan={plan} context={context} date={date} /> : null;
          })}
        </ul>
      )}

      {fardMarked.length > 0 || details.qada > 0 ? (
        <section className="flex flex-col gap-2" aria-label={labels.title}>
          <h4 className="text-base font-medium">{labels.title}</h4>
          {fardMarked.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {fardMarked.map((p) => (
                <li key={p} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {labels.prayers[p]} · {details.fard[p] === 'onTime' ? labels.onTime : labels.qada}
                </li>
              ))}
            </ul>
          ) : null}
          {details.qada > 0 ? <p className="text-sm text-muted-foreground">{t('qadaDay', { n: formatDigits(details.qada) })}</p> : null}
        </section>
      ) : null}

      <CoveredGate store={store} as="block">
        {(programs) => <ProgramDay programs={programs} date={date} />}
      </CoveredGate>

      {slipped.length > 0 && date < today ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-labelledby={`slip-${date}`}>
          <h4 id={`slip-${date}`} className="text-base font-medium">
            {t('slipTitle')}
          </h4>
          {review ? (
            <SavedReview review={review} />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm leading-7 text-muted-foreground">{evening ? t('eveningSaved') : t('noReview')}</p>
              <Button asChild variant="outline" tone="primary" size="sm">
                <Link href={{ pathname: '/practice/review', query: { tab: 'week' } }}>
                  {t('doReview')} <DirectionalArrow />
                </Link>
              </Button>
            </div>
          )}
          {slipped.map((row) => {
            const plan = store.plans.find((p) => p.id === row.planId);
            return plan ? <LearnFromSlip key={row.planId} plan={plan} store={store} today={today} context={context} habitTitle={row.title} /> : null;
          })}
        </section>
      ) : null}
    </div>
  );
}

function HabitDayRow({ row, plan, context, date }: { row: HabitDayDetail; plan: Plan; context: WirdContext; date: string }) {
  const t = useTranslations('practice.dayDetails');
  const tAsk = useTranslations('practice.asks');
  const word = useDayLogWord();
  const { today, habits } = context;
  const words = usePlanWords(plan, habitOf(plan, habits));
  const asking = row.state === 'ask';
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link href={`/practice/habits/${plan.id}`} className="text-base leading-7 font-medium break-words hover:underline" lang={words.titleLang}>
            {words.title}
          </Link>
          {row.done > 0 ? (
            <span className="text-sm text-muted-foreground">{t('amount', { done: words.amount(row.done), required: words.amount(row.required) })}</span>
          ) : null}
        </div>
        <StateChip state={row.state} label={word(row.state)} />
      </div>
      {asking ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{tAsk('question')}</p>
          <ActionPair layout="hug">
            <Button
              size="sm"
              onClick={() => {
                updateStore((s) => updatePlan(s, plan.id, (p) => answerDidIt(s, p, date, today)));
                toast.success(tAsk('savedDid'));
              }}
            >
              {tAsk('did')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              tone="neutral"
              onClick={() => {
                updateStore((s) => updatePlan(s, plan.id, (p) => answerDidNot(p, date, today)));
                toast.success(tAsk('savedDidNot'));
              }}
            >
              {tAsk('didNot')}
            </Button>
          </ActionPair>
        </div>
      ) : null}
      {row.reflection ? <ReflectionLines reflection={row.reflection} /> : null}
    </li>
  );
}

/** A state as a small calm chip: kept in the primary tint, «لم تتم» in a neutral one (never red). */
export function StateChip({ state, label }: { state: DayLogState; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm',
        state === 'done' || state === 'partial' ? 'bg-secondary text-primary-text' : 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

/** The two answers and the day note, as short quoted lines. */
export function ReflectionLines({ reflection, sin = false }: { reflection: Pick<Reflection, 'helped' | 'hard' | 'note'>; sin?: boolean }) {
  const t = useTranslations('practice.reflection');
  const items = [
    reflection.helped ? { key: 'helped', label: t(sin ? 'sinHelped' : 'helped'), text: reflection.helped } : null,
    reflection.hard ? { key: 'hard', label: t(sin ? 'sinHard' : 'hard'), text: reflection.hard } : null,
    reflection.note ? { key: 'note', label: t('note'), text: reflection.note } : null,
  ].filter((x): x is { key: string; label: string; text: string } => x !== null);
  if (items.length === 0) return null;
  return (
    <dl className="flex flex-col gap-1.5 border-s-2 border-border ps-3 text-sm leading-7">
      {items.map((item) => (
        <div key={item.key}>
          <dt className="inline text-muted-foreground">{item.label} </dt>
          <dd className="inline break-words">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function SavedReview({ review }: { review: WeeklyReview }) {
  const t = useTranslations('practice.dayDetails');
  const tWeekly = useTranslations('practice.heart.weekly');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  return (
    <div className="flex flex-col gap-1 text-sm leading-7">
      <p className="font-medium">{t('reviewSaved', { date: formatGregorian(review.weekOf, locale) })}</p>
      {review.weak.length > 0 ? (
        <p className="text-muted-foreground">
          {review.weak.map((w) => `${w.title} (${tWeekly('missed', { count: w.missed, n: formatDigits(w.missed) })})`).join(locale === 'ar' ? '، ' : ', ')}
        </p>
      ) : null}
      {review.message ? <p className="break-words">«{review.message}»</p> : null}
    </div>
  );
}

/**
 * «تعلّم من الخطأ» for a habit (round 6 §4, C-02d): the path the habit took to being dropped — the last fourteen days,
 * the last day it was kept, what the member wrote about what made it hard, his own plan for an obstacle, and a smaller
 * way back. His words only; no verdict. The same block shows in the daily and weekly reviews.
 */
export function LearnFromSlip({ plan, store, today, context, habitTitle }: { plan: Plan; store: Store; today: string; context: WirdContext; habitTitle?: string }) {
  const t = useTranslations('practice.learn');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const words = usePlanWords(plan, habitOf(plan, context.habits));
  const days = useMemo(() => {
    const out: { date: string; state: DayLogState }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = addDays(today, -i);
      out.push({ date, state: dayLogState(store, plan, date, today, context.planDays) });
    }
    return out;
  }, [store, plan, today, context.planDays]);
  const lastKept = [...days].reverse().find((d) => d.state === 'done' || d.state === 'partial')?.date ?? null;
  const missed = days.filter((d) => countsAsNotDone(d.state)).length;
  const hard = reflectionsOfPlan(store, plan.id)
    .filter((r) => r.hard)
    .slice(0, 3);
  const loop = plan.loops?.find((l) => l.obstacle || l.ifThen);
  const back = relapseSuggestionFor(plan);
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="flex items-center gap-2 text-base font-medium">
        <Lightbulb aria-hidden className="size-4 text-primary-text" />
        {t('title', { title: habitTitle ?? words.title })}
      </p>
      <ol className="flex gap-1" aria-label={t('path')}>
        {days.map((d) => (
          <li
            key={d.date}
            title={formatGregorian(d.date, locale)}
            className={cn(
              'h-2.5 flex-1 rounded-full',
              d.state === 'done' && 'bg-primary',
              d.state === 'partial' && 'bg-primary/50',
              countsAsNotDone(d.state) && 'bg-border',
              !['done', 'partial'].includes(d.state) && !countsAsNotDone(d.state) && 'bg-muted',
            )}
          />
        ))}
      </ol>
      <ul className="flex flex-col gap-1 text-sm leading-7">
        <li>{lastKept ? t('lastKept', { date: formatGregorian(lastKept, locale) }) : t('noneKept')}</li>
        {missed > 0 ? <li>{t('missed', { count: missed, n: formatDigits(missed) })}</li> : null}
        {hard.map((r) => (
          <li key={r.date} className="text-muted-foreground">
            {t('hardOn', { date: formatGregorian(r.date, locale) })} <span className="text-foreground">«{r.hard}»</span>
          </li>
        ))}
        {loop ? (
          <li className="text-muted-foreground">
            {t('yourPlan')} <span className="text-foreground">«{loop.ifThen || loop.obstacle}»</span>
          </li>
        ) : null}
        <li>{t('wayBack', { amount: words.amount(back) })}</li>
      </ul>
      <Link href="/practice/strategies" className="text-link self-start text-sm">
        {t('strategies')}
      </Link>
    </div>
  );
}

/** The «تخفَّف» part of a day: each running program's check-in, its two answers and note. Only rendered when open. */
function ProgramDay({ programs, date }: { programs: SinProgram[]; date: string }) {
  const t = useTranslations('practice.dayDetails');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const sins = useSinNames(locale);
  const names = new Map((sins.data ?? []).map((s) => [s.slug, locale === 'en' ? s.name || s.nameAr : s.nameAr]));
  const list = programDayDetails(programs, date);
  if (list.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={t('lighten')}>
      <h4 className="text-base font-medium">{t('lighten')}</h4>
      <ul className="flex flex-col gap-2">
        {list.map(({ sinSlug, checkIn }) => (
          <li key={sinSlug} className="flex flex-col gap-1 text-sm leading-7">
            <span className="font-medium">{names.get(sinSlug) ?? t('lighten')}</span>
            {checkIn ? (
              <>
                <span className="text-muted-foreground">{t(`checkIn.${checkIn.value}`)}</span>
                <ReflectionLines reflection={checkIn} sin />
              </>
            ) : (
              <span className="text-muted-foreground">{t('noCheckIn')}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A day of the week strip or the calendar in a dialog. */
export function DayDetailsDialog({ context, heart, date, onClose }: { context: WirdContext; heart: HeartData | null; date: string | null; onClose: () => void }) {
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const t = useTranslations('practice.dayDetails');
  return (
    <Dialog open={date !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{date ? formatGregorian(date, locale, true) : null}</DialogTitle>
          <DialogDescription className="sr-only">{t('dialogNote')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pe-1">{date ? <DayDetailsPanel context={context} heart={heart} date={date} bare /> : null}</div>
      </DialogContent>
    </Dialog>
  );
}
