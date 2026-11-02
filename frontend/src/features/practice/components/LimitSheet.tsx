'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  deletePlan,
  establishPlan,
  limitBlock,
  pausePlan,
  updatePlan,
  type LimitKind,
  type Limits,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { limitOptions } from '@/lib/practice/limits';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { usePlanWords } from './PlanCard';

interface LimitSheetProps {
  kind: LimitKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limits: Limits;
  /** The store: practice-core `limitBlock` says why adding is refused and the day it opens by itself. */
  store: Store;
  habits: ReadonlyMap<string, PracticeHabit>;
  today: string;
  /** After a place was freed (paused, deleted or moved to «راسخة»): the caller goes on with the addition. */
  onFreed?: () => void;
}

type Step = { kind: 'menu' } | { kind: 'pause' } | { kind: 'delete'; confirm: string | null };

/**
 * The limit sheet (redesign §3): shown instead of adding past a limit. «أكمل ما عندي» is the primary action and only
 * closes; «أوقِف … مؤقتًا» pauses one (its history stays), «احذف …» removes one after a confirmation, and «ثبّت … وابدأ
 * الجديدة» moves a graduation-ready sapling to «راسخة». The «تخفَّف» limit has only the first action.
 */
export function LimitSheet({ kind, open, onOpenChange, limits, store, habits, today, onFreed }: LimitSheetProps) {
  const t = useTranslations('practice.limits');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const block = open ? limitBlock(store, today, kind, limitOptions(habits)) : null;
  const why = block
    ? t(`why.${block.reason}`, { count: formatDigits(block.count), max: formatDigits(block.max) })
    : t(`${kind}.hint`);
  const [step, setStep] = useState<Step>({ kind: 'menu' });
  const [picked, setPicked] = useState<string | null>(null);
  const candidates = kind === 'sapling' ? limits.saplings : kind === 'periodic' ? limits.periodicPlans : [];
  const ready = kind === 'sapling' ? limits.graduationReady : [];

  function reset() {
    setStep({ kind: 'menu' });
    setPicked(null);
  }

  function close(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  /** A place was freed: the caller goes on (`onFreed`), or the sheet just closes. */
  function freed(change: () => void) {
    change();
    reset();
    if (onFreed) onFreed();
    else onOpenChange(false);
  }

  const pause = (id: string) => freed(() => updateStore((s) => updatePlan(s, id, (p) => pausePlan(p, today))));
  const remove = (id: string) => freed(() => updateStore((s) => deletePlan(s, id)));
  const establish = (id: string) => freed(() => updateStore((s) => updatePlan(s, id, (p) => establishPlan(p, today))));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="leading-8">{t(`${kind}.title`)}</DialogTitle>
          <DialogDescription className="leading-7">{why}</DialogDescription>
        </DialogHeader>
        {block?.unlocksOn ? (
          <p className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm leading-7">
            {t('unlocksOn', { date: formatGregorian(block.unlocksOn, locale, true) })}
          </p>
        ) : null}

        {step.kind === 'menu' ? (
          <div className="flex flex-col gap-2">
            <Button tone="primary" onClick={() => close(false)}>
              {t('keepGoing')}
            </Button>
            {ready.map((plan) => (
              <Button key={plan.id} variant="outline" tone="primary" className="h-auto py-2 whitespace-normal" onClick={() => establish(plan.id)}>
                <EstablishLabel plan={plan} habits={habits} />
              </Button>
            ))}
            {candidates.length > 0 ? (
              <>
                <Button variant="outline" tone="neutral" onClick={() => setStep({ kind: 'pause' })}>
                  {t(`${kind}.pause`)}
                </Button>
                <Button variant="outline" tone="destructive" onClick={() => setStep({ kind: 'delete', confirm: null })}>
                  {t(`${kind}.delete`)}
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted-foreground">{step.kind === 'pause' ? t('pickPause') : t('pickDelete')}</legend>
            {candidates.map((plan) => (
              <label key={plan.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-muted">
                <input
                  type="radio"
                  name="limit-pick"
                  className="size-4 accent-primary"
                  checked={picked === plan.id}
                  onChange={() => setPicked(plan.id)}
                />
                <PlanTitle plan={plan} habits={habits} />
              </label>
            ))}
            {step.kind === 'delete' && step.confirm ? (
              <p role="status" className="text-sm leading-7 text-muted-foreground">
                {t('deleteNote')}
              </p>
            ) : null}
            <DialogFooter className="mt-2 gap-2 sm:justify-start">
              {step.kind === 'pause' ? (
                <Button tone="primary" disabled={picked === null} onClick={() => picked && pause(picked)}>
                  {t('pauseAction')}
                </Button>
              ) : step.confirm ? (
                <Button tone="destructive" onClick={() => remove(step.confirm as string)}>
                  {t('deleteConfirm')}
                </Button>
              ) : (
                <Button tone="destructive" variant="outline" disabled={picked === null} onClick={() => picked && setStep({ kind: 'delete', confirm: picked })}>
                  {t('deleteAction')}
                </Button>
              )}
              <Button variant="outline" tone="neutral" onClick={() => setStep({ kind: 'menu' })}>
                {t('back')}
              </Button>
            </DialogFooter>
          </fieldset>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanTitle({ plan, habits }: { plan: Plan; habits: ReadonlyMap<string, PracticeHabit> }) {
  const words = usePlanWords(plan, habitOf(plan, habits));
  return (
    <span lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
      {words.title}
    </span>
  );
}

function EstablishLabel({ plan, habits }: { plan: Plan; habits: ReadonlyMap<string, PracticeHabit> }) {
  const t = useTranslations('practice.limits');
  const words = usePlanWords(plan, habitOf(plan, habits));
  return <>{t('establishAndStart', { title: words.title })}</>;
}
