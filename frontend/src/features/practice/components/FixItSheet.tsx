'use client';

import { useId } from 'react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  alternativePlan,
  annotateCheckIn,
  checkIn,
  limitChoices,
  logForDay,
  shortestTextId,
  updatePlan,
  type LimitRef,
  type SinProgram,
  type Triggers,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { QuoteCard } from '@/components/shared/quote';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeHabit, SinProgramCommon, SinProgramEntry } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { useLimitLabel } from '../hooks/useLimitLabel';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { TriggerChips } from './TriggerChips';

interface FixItSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: SinProgram;
  entry: SinProgramEntry;
  common: SinProgramCommon;
  habits: ReadonlyMap<string, PracticeHabit>;
  /** Every program's evidence, fetched once for all. */
  quotes: readonly QuoteDto[];
  today: string;
}

/**
 * «خربانة؟ صلّحها» in one sheet, four short steps: (1) تب الآن with a short text from the after-fall evidence and one tap
 * that marks the day «وقعت ثم تبت»; (2) «أتبع السيئة الحسنة»: the minimum of an alternative habit the visitor already
 * keeps, otherwise a generic «حسنة الآن» mark on the day; (3) the trigger chips; (4) one small limit for tomorrow.
 * Steps 2–4 write onto today's check-in, so they wait for step 1 when the day has none yet.
 */
export function FixItSheet({ open, onOpenChange, program, entry, common, habits, quotes, today }: FixItSheetProps) {
  const t = useTranslations('leaveSin.fixit');
  const english = useLocale() === 'en';
  const snapshot = usePracticeStore();
  const actions = english ? entry.actionsEn : entry.actionsAr;
  const limitLabel = useLimitLabel(actions);
  const day = program.checkIns.find((c) => c.date === today) ?? null;
  const fell = day !== null && day.value !== 'held';
  const duaId = shortestTextId(common.afterFall.evidence ?? [], quotes);
  const dua = quotes.find((q) => q.id === duaId) ?? null;
  const alt = snapshot ? alternativePlan(snapshot.store.plans, entry.alternatives) : null;
  const altHabit = alt ? habitOf(alt.plan, habits) : undefined;
  const habitTitle = altHabit ? (english ? altHabit.titleEn : altHabit.titleAr) : (alt?.plan.title ?? '');
  const habitDone = alt ? (alt.plan.log[today] ?? 0) >= alt.minimum : false;
  const choices = limitChoices(actions.length, day?.triggers);

  function edit(change: (p: SinProgram) => SinProgram) {
    updateStore((store) => ({ ...store, programs: store.programs.map((p) => (p.sinSlug === program.sinSlug ? change(p) : p)) }));
  }

  function repent() {
    if (day?.value === 'fell_repented') return;
    edit((p) => checkIn(p, today, 'fell_repented'));
  }

  function logHabit() {
    if (!alt) return;
    updateStore((store) => updatePlan(store, alt.plan.id, (plan) => logForDay(plan, today, alt.minimum, today)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{english ? common.afterFall.titleEn : common.afterFall.titleAr}</DialogTitle>
          <DialogDescription>{t('lead')}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-6">
          <Step n={1} title={t('step1')}>
            {dua ? <QuoteCard quote={dua} density="compact" intent="good-deed" /> : null}
            {day?.value === 'fell_repented' ? (
              <Done>{t('repented')}</Done>
            ) : (
              <Button tone="primary" className="self-start" onClick={repent}>
                {t('repent')}
              </Button>
            )}
          </Step>

          <Step n={2} title={t('step2')} muted={!fell}>
            {!fell ? null : alt ? (
              habitDone ? (
                <Done>{t('habitLogged', { habit: habitTitle })}</Done>
              ) : (
                <Button variant="outline" tone="primary" className="button-wrap self-start" onClick={logHabit}>
                  {t('logHabit', { habit: habitTitle })}
                </Button>
              )
            ) : day?.goodDeed ? (
              <Done>{t('goodDeedDone')}</Done>
            ) : (
              <div className="flex flex-col items-start gap-1">
                <Button variant="outline" tone="primary" onClick={() => edit((p) => annotateCheckIn(p, today, { goodDeed: true }))}>
                  {t('goodDeed')}
                </Button>
                <p className="text-sm text-muted-foreground">{t('goodDeedHint')}</p>
              </div>
            )}
          </Step>

          <Step n={3} title={t('step3')} muted={!fell}>
            {fell ? (
              <TriggerChips
                hideTitle
                value={day.triggers ?? {}}
                onChange={(next: Triggers) => edit((p) => annotateCheckIn(p, today, { triggers: next }))}
              />
            ) : null}
          </Step>

          <Step n={4} title={t('step4')} muted={!fell}>
            {fell ? (
              <LimitPicker
                choices={choices}
                selected={day.nextLimit ?? null}
                label={limitLabel}
                onSelect={(ref) => edit((p) => annotateCheckIn(p, today, { nextLimit: ref }))}
              />
            ) : null}
            {fell && day.nextLimit ? <p className="text-sm text-muted-foreground">{t('limitPicked')}</p> : null}
          </Step>
        </ol>
        {!fell ? <p className="text-sm text-muted-foreground">{t('needCheckIn')}</p> : null}
        <DialogFooter className="sm:justify-start">
          <Button variant="ghost" tone="neutral" onClick={() => onOpenChange(false)}>
            {t('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, title, muted = false, children }: { n: number; title: string; muted?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <li aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className={cn('flex items-center gap-2 text-lg font-medium', muted && 'text-muted-foreground')}>
        <span className="flex size-7 items-center justify-center rounded-full border border-border text-sm" aria-hidden>
          {n}
        </span>
        {title}
      </h3>
      {children}
    </li>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-primary" role="status">
      <Check className="size-4" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

interface LimitPickerProps {
  choices: LimitRef[];
  selected: LimitRef | null;
  label: (ref: LimitRef) => string | null;
  onSelect: (ref: LimitRef | null) => void;
}

/** One limit, as a list of radio-like chips; a second tap clears it. */
export function LimitPicker({ choices, selected, label, onSelect }: LimitPickerProps) {
  return (
    <ul className="flex flex-col gap-2">
      {choices.flatMap((ref) => {
        const text = label(ref);
        if (!text) return [];
        const on = selected === ref;
        return [
          <li key={ref}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : ref)}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-xl border px-4 py-2 text-start leading-7 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
                on ? 'border-primary text-primary' : 'border-border hover:bg-muted',
              )}
            >
              {on ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              <span>{text}</span>
            </button>
          </li>,
        ];
      })}
    </ul>
  );
}
