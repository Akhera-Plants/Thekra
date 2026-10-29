'use client';

import { useId, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { BookOpen, Check, Clock, PencilLine, Undo2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  baseAmount,
  correctLog,
  decreaseTo,
  deletePlan,
  increase,
  logDone,
  nextStep,
  startSeason,
  updatePlan,
  type Plan,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateStore } from '@/lib/practice/local-store';
import type { PlanToday } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { z } from '@/lib/zod';
import { amountLabel } from './amount-label';
import { FetchedEvidence } from './EvidenceQuotes';
import { LogEditor } from './LogEditor';

/** Whole amounts only: the account stores logs as integers (sync contract §2). */
const MAX_LOG = 1000;

interface PlanCardProps {
  plan: Plan;
  habit: PracticeHabit | undefined;
  view: PlanToday;
  today: string;
  /** Last day of Ramadan when today is in Ramadan, else null. */
  ramadanUntil: string | null;
}

export function changePlan(id: string, change: (plan: Plan) => Plan): void {
  updateStore((store) => updatePlan(store, id, change));
}

/** Hook for the plan's title and unit wording in the page language. */
export function usePlanWords(plan: Plan, habit: PracticeHabit | undefined) {
  const locale = useLocale();
  const t = useTranslations('practice.units');
  const english = locale === 'en';
  const title = habit ? (english ? habit.titleEn : habit.titleAr) : plan.title;
  const unit = habit ? (english ? habit.unitLabelEn : habit.unitLabelAr) : t(plan.unit);
  // Without the catalog the stored (Arabic) title is all there is: mark it as Arabic on /en.
  const titleLang = !habit && english ? 'ar' : undefined;
  return { title, titleLang, unit, amount: (n: number) => amountLabel(n, plan.unit, unit) };
}

export function PlanCard({ plan, habit, view, today, ramadanUntil }: PlanCardProps) {
  const t = useTranslations('practice.today');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const words = usePlanWords(plan, habit);
  const [showEvidence, setShowEvidence] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingLog, setEditingLog] = useState(false);
  /** The last «تمّ» or partial log in this visit, so it can be undone in one tap. */
  const [lastLog, setLastLog] = useState<{ date: string; before: number } | null>(null);
  const evidenceId = useId();
  const seasonStep = nextStep(baseAmount(plan));
  const seasonAmount = seasonStep === null ? null : plan.ceiling !== undefined ? Math.min(seasonStep, plan.ceiling) : seasonStep;

  function log(amount: number) {
    setLastLog({ date: today, before: plan.log[today] ?? 0 });
    changePlan(plan.id, (p) => logDone(p, today, amount));
  }

  function undoLastLog() {
    if (!lastLog) return;
    changePlan(plan.id, (p) => correctLog(p, lastLog.date, lastLog.before));
    setLastLog(null);
  }

  return (
    <article
      id={`plan-${plan.id}`}
      tabIndex={-1}
      className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-card p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-6"
      aria-labelledby={`${evidenceId}-title`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id={`${evidenceId}-title`}
          className="text-xl font-medium"
          lang={words.titleLang}
          dir={words.titleLang ? 'rtl' : undefined}
        >
          {words.title}
        </h3>
        {view.isComplete ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            <Check className="size-4" aria-hidden />
            {t('complete')}
          </span>
        ) : view.isDue ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            <Clock className="size-4" aria-hidden />
            {t('dueNow')}
          </span>
        ) : null}
      </header>

      <p className="text-base leading-8">
        {t('required', { amount: words.amount(view.required) })}
        {view.done > 0 ? <> · {t('done', { amount: words.amount(view.done) })}</> : null}
      </p>
      {view.nextSlot && !view.isComplete ? (
        <p className="text-sm text-muted-foreground">{t('nextSlot', { time: formatDigits(view.nextSlot) })}</p>
      ) : null}
      {view.isPartial ? (
        <p className="next-step !mt-0">
          <strong>{t('fixItTitle')}</strong>
          {t('fixItBody')}
        </p>
      ) : null}

      {!view.isComplete ? (
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            className="solid-button button-wrap"
            onClick={() => log(view.remaining)}
          >
            <Check aria-hidden />
            {t('markDone')}
          </button>
          <PartialLog unit={words.unit} onLog={log} />
        </div>
      ) : null}

      <div role="status" aria-live="polite" className="empty:hidden">
        {lastLog ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {t('logged')}
            <Button variant="ghost" tone="primary" size="sm" onClick={undoLastLog}>
              <Undo2 aria-hidden />
              {t('undo')}
            </Button>
          </p>
        ) : null}
      </div>

      {editingLog ? (
        <LogEditor
          plan={plan}
          today={today}
          unit={words.unit}
          onDone={() => {
            setEditingLog(false);
            setLastLog(null);
          }}
        />
      ) : null}

      {view.canIncrease && view.increaseTo !== null ? (
        <div className="next-step !mt-0 flex flex-col items-start gap-2">
          <p>{t('increaseOffer', { amount: words.amount(view.increaseTo) })}</p>
          <Button
            className="h-auto whitespace-normal py-2 text-start"
            variant="outline"
            tone="primary"
            size="sm"
            onClick={() => changePlan(plan.id, (p) => increase(p, today))}
          >
            {t('increase')}
          </Button>
        </div>
      ) : null}

      {view.relapseTo !== null ? (
        <div className="next-step !mt-0 flex flex-col items-start gap-2">
          <p>{t('relapse', { amount: words.amount(view.relapseTo) })}</p>
          <Button
            className="h-auto whitespace-normal py-2 text-start"
            variant="outline"
            tone="primary"
            size="sm"
            onClick={() => changePlan(plan.id, (p) => decreaseTo(p, view.relapseTo as number, today))}
          >
            {t('relapseAction', { amount: words.amount(view.relapseTo) })}
          </Button>
        </div>
      ) : null}

      {plan.season ? (
        <p className="text-sm leading-7 text-muted-foreground">
          {t('seasonOn', { date: formatGregorian(plan.season.until, locale) })}
        </p>
      ) : ramadanUntil && seasonAmount !== null ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm leading-7 text-muted-foreground">{t('seasonOffer', { amount: words.amount(seasonAmount) })}</p>
          <Button
            className="h-auto whitespace-normal py-2 text-start"
            variant="outline"
            tone="neutral"
            size="sm"
            onClick={() => changePlan(plan.id, (p) => startSeason(p, seasonAmount, ramadanUntil))}
          >
            {t('seasonStart')}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {habit && habit.evidence.length > 0 ? (
          <Button
            variant="ghost"
            tone="primary"
            size="sm"
            aria-expanded={showEvidence}
            aria-controls={`${evidenceId}-evidence`}
            onClick={() => setShowEvidence((open) => !open)}
          >
            <BookOpen aria-hidden />
            {showEvidence ? t('hideEvidence') : t('showEvidence')}
          </Button>
        ) : null}
        {!editingLog ? (
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => setEditingLog(true)}>
            <PencilLine aria-hidden />
            {t('editLog.open')}
          </Button>
        ) : null}
        {confirmRemove ? (
          <>
            <Button variant="outline" tone="destructive" size="sm" onClick={() => updateStore((s) => deletePlan(s, plan.id))}>
              {t('removeConfirm')}
            </Button>
            <Button variant="ghost" tone="neutral" size="sm" onClick={() => setConfirmRemove(false)}>
              {t('keep')}
            </Button>
          </>
        ) : (
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => setConfirmRemove(true)}>
            {t('remove')}
          </Button>
        )}
      </div>
      {showEvidence && habit ? (
        <div id={`${evidenceId}-evidence`}>
          <FetchedEvidence ids={habit.evidence} />
        </div>
      ) : null}
    </article>
  );
}

function PartialLog({ unit, onLog }: { unit: string; onLog: (amount: number) => void }) {
  const t = useTranslations('practice.today');
  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .regex(/^\d+$/, t('partialError'))
          .refine((value) => Number(value) > 0 && Number(value) <= MAX_LOG, t('partialError')),
      }),
    [t],
  );
  const form = useForm<{ amount: string }>({ resolver: zodResolver(schema), defaultValues: { amount: '' } });

  function handleSubmit(values: { amount: string }) {
    onLog(Number(values.amount));
    form.reset({ amount: '' });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-wrap items-end gap-2" noValidate>
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem className="w-36">
              <FormLabel>{t('partialLabel', { unit })}</FormLabel>
              <FormControl>
                <Input type="number" inputMode="numeric" min={1} step={1} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit" className="outline-button button-wrap">
          {t('logPartial')}
        </button>
      </form>
    </Form>
  );
}
