'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ARCHIVE_MAX,
  ARCHIVE_RESET_DAYS,
  canArchive,
  establishPlan,
  limitBlock,
  updatePlan,
  type LimitKind,
  type Limits,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { limitOptions } from '@/lib/practice/limits';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { ArchiveDialog, DeleteDialog } from './habits/HabitActions';
import { usePlanWords } from './plan-words';

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

type Step = { kind: 'menu' } | { kind: 'pause' };

/**
 * The limit sheet (redesign §3, round 5 F-30 a): shown instead of adding past a limit. One pair: «أكمل ما عندي» (solid,
 * only closes) and «أرشِف …» (round 6: pause = «الأرشيف», one concept; its history stays). Archiving goes through
 * practice-core `archivePlan` (the confirmation says the 3-day progress rule), so the archive's cap of 10 holds: with a
 * full archive the same place offers «احذف …» with its confirmation instead (owner chat: beyond 10 the member deletes).
 * A graduation-ready sapling also offers «ثبّت … وابدأ الجديدة». The «تخفَّف» limit has only the first action. The day
 * a place opens by itself is written in words.
 */
export function LimitSheet({ kind, open, onOpenChange, limits, store, habits, today, onFreed }: LimitSheetProps) {
  const t = useTranslations('practice.limits');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const block = open ? limitBlock(store, today, kind, limitOptions(habits)) : null;
  // With a full archive (10) only deleting frees a place: the periodic line says so.
  const reason = block?.reason === 'periodic_full' && !canArchive(store) ? 'periodic_full_archive_full' : block?.reason;
  const why = block && reason
    ? t(`why.${reason}`, { count: formatDigits(block.count), max: formatDigits(block.max) })
    : t(`${kind}.hint`);
  const [step, setStep] = useState<Step>({ kind: 'menu' });
  const [picked, setPicked] = useState<string | null>(null);
  /** The plan whose archive / delete confirmation is open (the sheet steps aside meanwhile). */
  const [confirming, setConfirming] = useState<{ plan: Plan; action: 'archive' | 'delete' } | null>(null);
  const room = canArchive(store);
  const candidates = kind === 'sapling' ? limits.saplings : kind === 'periodic' ? limits.periodicPlans : [];
  const ready = kind === 'sapling' ? limits.graduationReady : [];

  function reset() {
    setStep({ kind: 'menu' });
    setPicked(null);
    setConfirming(null);
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

  const establish = (id: string) => freed(() => updateStore((s) => updatePlan(s, id, (p) => establishPlan(p, today))));

  const confirmPlan = (id: string) => {
    const plan = candidates.find((p) => p.id === id);
    if (plan) setConfirming({ plan, action: room ? 'archive' : 'delete' });
  };

  return (
    <>
    <Dialog open={open && confirming === null} onOpenChange={close}>
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
            <ActionPair>
              <Button tone="primary" onClick={() => close(false)}>
                {t('keepGoing')}
              </Button>
              {candidates.length > 0 ? (
                <Button variant="outline" tone={room ? 'primary' : 'destructive'} onClick={() => setStep({ kind: 'pause' })}>
                  {room ? t(`${kind}.pause`) : t(`${kind}.delete`)}
                </Button>
              ) : null}
            </ActionPair>
            {ready.map((plan) => (
              <Button key={plan.id} variant="outline" tone="primary" className="h-auto py-2 whitespace-normal" onClick={() => establish(plan.id)}>
                <EstablishLabel plan={plan} habits={habits} />
              </Button>
            ))}
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm leading-7 text-muted-foreground">
              {room ? t('pickPause', { days: formatDigits(ARCHIVE_RESET_DAYS) }) : t('pickDelete', { max: formatDigits(ARCHIVE_MAX) })}
            </legend>
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
            <DialogFooter className="mt-2 gap-2 sm:justify-start">
              <Button tone={room ? 'primary' : 'destructive'} disabled={picked === null} onClick={() => picked && confirmPlan(picked)}>
                {room ? t('pauseAction') : t('deleteAction')}
              </Button>
              <Button variant="outline" tone="neutral" onClick={() => setStep({ kind: 'menu' })}>
                {t('back')}
              </Button>
            </DialogFooter>
          </fieldset>
        )}
      </DialogContent>
    </Dialog>
    <ArchiveDialog
      plan={confirming?.action === 'archive' ? confirming.plan : null}
      store={store}
      today={today}
      habits={habits}
      onOpenChange={(o) => (o ? undefined : setConfirming(null))}
      onDone={() => freed(() => undefined)}
    />
    <DeleteDialog
      plan={confirming?.action === 'delete' ? confirming.plan : null}
      habits={habits}
      onOpenChange={(o) => (o ? undefined : setConfirming(null))}
      onDone={() => freed(() => undefined)}
    />
    </>
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
