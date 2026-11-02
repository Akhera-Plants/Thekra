'use client';

import { useId, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { BookOpen, Undo2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  correctLog,
  decreaseTo,
  deletePlan,
  establishPlan,
  graduationReady,
  increase,
  isPaused,
  nowIso,
  pausePlan,
  resumePlan,
  logDone,
  startSeason,
  updatePlan,
  type Plan,
  type PrayerTimesWithSunrise,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateStore } from '@/lib/practice/local-store';
import { planAction, ramadanSeasonOffer, type PlanToday } from '@/lib/practice/plans';
import { fixPlanSlots, hasUnsuitableSlot, suitableChoices } from '@/lib/practice/windows';
import type { PracticeHabit } from '@/lib/types/practice';
import { z } from '@/lib/zod';
import { useDeletesEverywhere } from '../hooks/useDeletesEverywhere';
import { amountLabel } from './amount-label';
import { FetchedEvidence } from './EvidenceQuotes';
import { LogEditor } from './LogEditor';
import { PlanActionButton, PlanOptions } from './PlanCardParts';
import { PlanEditForm } from './PlanEditForm';
import { HabitLoops, HabitLoopsToggle } from './LoopBuilder';
import { WindowLine } from './SlotPicker';

/** Whole amounts only: the account stores logs as integers (sync contract §2). */
const MAX_LOG = 1000;

interface PlanCardProps {
  plan: Plan;
  habit: PracticeHabit | undefined;
  view: PlanToday;
  today: string;
  hijriOffset: number;
  /** Today's prayer times (with sunrise when known): the deed window's clock times. */
  prayer: PrayerTimesWithSunrise | undefined;
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
  const catalogUnit = habit ? (english ? habit.unitLabelEn : habit.unitLabelAr) : t(plan.unit);
  // The number fields count units; for prayers the word says how a unit maps to rak'ahs.
  const unit = habit?.rakah ? t(habit.rakah === 'pairs' ? 'rakahPairs' : 'rakahOdd') : catalogUnit;
  // Without the catalog the stored (Arabic) title is all there is: mark it as Arabic on /en.
  const titleLang = !habit && english ? 'ar' : undefined;
  return { title, titleLang, unit, amount: (n: number) => amountLabel(n, plan.unit, unit, english, habit?.rakah) };
}

/**
 * A habit row of «عاداتي»: the title with one status line, and ONE action at its end (owner, 2026-11-01): «سجّل»,
 * «تمّ ✓» or «استأنف» ({@link planAction}). A habit asked for today also offers a partial amount and its offers
 * (increase, lighter restart, «وضع رمضان» in Ramadan only); everything else sits in «خيارات».
 */
export function PlanCard({ plan, habit, view, today, hijriOffset, prayer }: PlanCardProps) {
  const t = useTranslations('practice.today');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const words = usePlanWords(plan, habit);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showLoops, setShowLoops] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const everywhere = useDeletesEverywhere();
  const [editingLog, setEditingLog] = useState(false);
  /** The last log or untick of today in this visit, so it can be undone in one tap. */
  const [lastLog, setLastLog] = useState<{ date: string; before: number; cleared: boolean } | null>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const paused = isPaused(plan);
  const compact = !view.isDueToday || paused;
  const canGraduate = graduationReady(plan, today);
  const season = compact ? null : ramadanSeasonOffer(plan, today, hijriOffset);
  const unsuitable = hasUnsuitableSlot(plan, habit?.window, prayer);
  const action = planAction(view, paused);

  function log(amount: number) {
    setLastLog({ date: today, before: plan.log[today] ?? 0, cleared: false });
    changePlan(plan.id, (p) => logDone(p, today, amount));
  }

  /** «تمّ ✓» tapped again: back to before this visit's log, else the day is cleared; «تراجع» restores it. */
  function unlog() {
    const before = lastLog && !lastLog.cleared ? lastLog.before : 0;
    setLastLog({ date: today, before: plan.log[today] ?? 0, cleared: true });
    changePlan(plan.id, (p) => correctLog(p, today, before));
  }

  function undoLastLog() {
    if (!lastLog) return;
    changePlan(plan.id, (p) => correctLog(p, lastLog.date, lastLog.before));
    setLastLog(null);
  }

  function fixSlots() {
    const choices = suitableChoices(plan, habit, prayer);
    if (choices) updateStore((store) => fixPlanSlots(store, plan.id, choices, nowIso()));
    else setEditing(true);
  }

  const status = paused
    ? t('pausedSince', { date: formatGregorian(plan.pausedOn as string, locale) })
    : compact
      ? view.done > 0
        ? t('done', { amount: words.amount(view.done) })
        : null
      : [
          view.isComplete ? null : view.isDue ? t('dueNow') : view.nextSlot ? t('nextSlot', { time: formatDigits(view.nextSlot) }) : null,
          t('required', { amount: words.amount(view.required) }),
          view.done > 0 ? t('done', { amount: words.amount(view.done) }) : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <article
      id={`plan-${plan.id}`}
      tabIndex={-1}
      className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-card p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-5"
      aria-labelledby={titleId}
    >
      <header className="flex items-start justify-between gap-3 md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 id={titleId} className="text-lg font-medium md:text-xl" lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
            {words.title}
          </h4>
          {status ? <p className="text-sm leading-7 text-muted-foreground">{status}</p> : null}
        </div>
        <PlanActionButton
          action={action}
          describedBy={titleId}
          onLog={() => log(Math.max(1, view.remaining))}
          onUnlog={unlog}
          onResume={() => changePlan(plan.id, (p) => resumePlan(p, today))}
        />
      </header>

      <div role="status" aria-live="polite" className="empty:hidden">
        {lastLog ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {lastLog.cleared ? t('unlogged') : t('logged')}
            <Button variant="outline" tone="primary" size="sm" onClick={undoLastLog}>
              <Undo2 aria-hidden />
              {t('undo')}
            </Button>
          </p>
        ) : null}
      </div>

      {unsuitable ? (
        <div className="next-step !mt-0 flex flex-col items-start gap-2">
          <p>{t('slotsUnsuitable')}</p>
          <WindowLine window={habit?.window} prayer={prayer} />
          <Button variant="outline" tone="primary" size="sm" onClick={fixSlots}>
            {t('slotsFix')}
          </Button>
        </div>
      ) : null}

      {!compact && view.isPartial ? (
        <p className="next-step !mt-0">
          <strong>{t('fixItTitle')}</strong>
          {t('fixItBody')}
        </p>
      ) : null}
      {!compact && !view.isComplete ? <PartialLog unit={words.unit} onLog={log} /> : null}

      {canGraduate ? (
        <Offer text={t('graduateOffer')} action={t('graduate')} onAction={() => changePlan(plan.id, (p) => establishPlan(p, today))} />
      ) : null}
      {!compact && view.canIncrease && view.increaseTo !== null ? (
        <Offer
          text={t('increaseOffer', { amount: words.amount(view.increaseTo) })}
          action={t('increase')}
          onAction={() => changePlan(plan.id, (p) => increase(p, today))}
        />
      ) : null}
      {!compact && view.relapseTo !== null ? (
        <Offer
          text={t('relapse', { amount: words.amount(view.relapseTo) })}
          action={t('relapseAction', { amount: words.amount(view.relapseTo) })}
          onAction={() => changePlan(plan.id, (p) => decreaseTo(p, view.relapseTo as number, today))}
        />
      ) : null}
      {!compact && plan.season ? (
        <p className="text-sm leading-7 text-muted-foreground">{t('seasonOn', { date: formatGregorian(plan.season.until, locale) })}</p>
      ) : null}
      {season ? (
        <Offer
          text={t('seasonOffer', { amount: words.amount(season.amount) })}
          action={t('seasonStart')}
          onAction={() => {
            // Checked again on the tap: a page left open past the last night of Ramadan offers nothing.
            const still = ramadanSeasonOffer(plan, today, hijriOffset);
            if (still) changePlan(plan.id, (p) => startSeason(p, still.amount, still.until));
          }}
        />
      ) : null}

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

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {habit && habit.evidence.length > 0 ? (
          <button
            type="button"
            className="outline-button"
            aria-expanded={showEvidence}
            aria-controls={`${baseId}-evidence`}
            onClick={() => setShowEvidence((open) => !open)}
          >
            <BookOpen aria-hidden />
            {showEvidence ? t('hideEvidence') : t('showEvidence')}
          </button>
        ) : null}
        <HabitLoopsToggle
          plan={plan}
          open={showLoops}
          onToggle={() => setShowLoops((open) => !open)}
          controls={`${baseId}-loops`}
        />
        <PlanOptions
          isPaused={paused}
          deedHref={habit ? `/good-deeds/${habit.deed}` : null}
          onEdit={() => setEditing(true)}
          onFixLog={() => setEditingLog(true)}
          onPause={() => changePlan(plan.id, (p) => pausePlan(p, today))}
          onRemove={() => setConfirmRemove(true)}
        />
      </div>
      {confirmRemove ? (
        <div className="flex flex-col items-start gap-2" role="group" aria-label={t('remove')}>
          <p className="text-sm leading-7 text-muted-foreground" role="status">
            {everywhere ? t('removeNoteAccount') : t('removeNoteDevice')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" tone="destructive" size="sm" onClick={() => updateStore((s) => deletePlan(s, plan.id))}>
              {t('removeConfirm')}
            </Button>
            <Button variant="outline" tone="neutral" size="sm" onClick={() => setConfirmRemove(false)}>
              {t('keep')}
            </Button>
          </div>
        </div>
      ) : null}
      {editing ? (
        <PlanEditForm plan={plan} habit={habit} today={today} amountLabel={words.amount} onDone={() => setEditing(false)} />
      ) : null}
      {showLoops ? (
        <div id={`${baseId}-loops`}>
          <HabitLoops plan={plan} />
        </div>
      ) : null}
      {showEvidence && habit ? (
        <div id={`${baseId}-evidence`}>
          <FetchedEvidence ids={habit.evidence} />
        </div>
      ) : null}
    </article>
  );
}

/** One offer (increase, lighter restart, Ramadan, graduation): a line and its outlined button. */
function Offer({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="next-step !mt-0 flex flex-col items-start gap-2">
      <p>{text}</p>
      <Button className="h-auto whitespace-normal py-2 text-start" variant="outline" tone="primary" size="sm" onClick={onAction}>
        {action}
      </Button>
    </div>
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
            <FormItem className="w-52">
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
