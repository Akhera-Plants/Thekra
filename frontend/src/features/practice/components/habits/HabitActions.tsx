'use client';

import { useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ARCHIVE_MAX,
  archiveNote,
  archivePlan,
  canArchive,
  deletePlan,
  habitAddChoice,
  restorePlanInStore,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { limitOptions } from '@/lib/practice/limits';
import { getPracticeSnapshot, updateStore } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { useDeletesEverywhere } from '../../hooks/useDeletesEverywhere';
import { usePlanWords } from '../plan-words';

interface PlanDialogProps {
  plan: Plan | null;
  store: Store;
  today: string;
  habits: ReadonlyMap<string, PracticeHabit>;
  onOpenChange: (open: boolean) => void;
  /** After the change (the sheet closes itself). */
  onDone?: () => void;
}

/**
 * «أرشِفها» with its note (round 6 §2, owner chat + C-01d): archive IS the old pause — one concept. The sheet says
 * plainly that after more than 3 days in the archive the habit's progress starts again (the logged history stays in
 * «سجلّي»). A full archive (10) says so and offers nothing but closing: the member deletes one first.
 */
export function ArchiveDialog({ plan, store, today, habits, onOpenChange, onDone }: PlanDialogProps) {
  const t = useTranslations('practice.archive');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const room = canArchive(store);
  const note = plan ? archiveNote(plan, today) : null;
  return (
    <AlertDialog open={plan !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{plan ? <PlanTitleText plan={plan} habits={habits} template={(title) => t('confirmTitle', { title })} /> : null}</AlertDialogTitle>
          <AlertDialogDescription className="leading-7">
            {room && note
              ? t('note', { days: formatDigits(note.resetDays), date: formatGregorian(note.keepsProgressUntil, locale) })
              : t('full', { max: formatDigits(ARCHIVE_MAX) })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <ActionPair>
            {room ? (
              <Button
                icon={<Archive aria-hidden />}
                onClick={() => {
                  if (!plan) return;
                  updateStore((s) => archivePlan(s, plan.id, today));
                  toast.success(t('archived'));
                  onOpenChange(false);
                  onDone?.();
                }}
              >
                {t('confirm')}
              </Button>
            ) : null}
            <Button variant="outline" tone="neutral" onClick={() => onOpenChange(false)}>
              {room ? t('cancel') : t('close')}
            </Button>
          </ActionPair>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** «احذفها» with its confirmation (history is deleted with it, on every device when signed in). */
export function DeleteDialog({ plan, habits, onOpenChange, onDone }: Omit<PlanDialogProps, 'store' | 'today'>) {
  const t = useTranslations('practice.archive');
  const tToday = useTranslations('practice.today');
  const everywhere = useDeletesEverywhere();
  return (
    <AlertDialog open={plan !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{plan ? <PlanTitleText plan={plan} habits={habits} template={(title) => t('deleteTitle', { title })} /> : null}</AlertDialogTitle>
          <AlertDialogDescription className="leading-7">{everywhere ? tToday('removeNoteAccount') : tToday('removeNoteDevice')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <ActionPair>
            <Button
              tone="destructive"
              icon={<Trash2 aria-hidden />}
              onClick={() => {
                if (!plan) return;
                updateStore((s) => deletePlan(s, plan.id));
                toast.success(t('deleted'));
                onOpenChange(false);
                onDone?.();
              }}
            >
              {tToday('removeConfirm')}
            </Button>
            <Button variant="outline" tone="neutral" onClick={() => onOpenChange(false)}>
              {tToday('keep')}
            </Button>
          </ActionPair>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Takes a habit out of the archive. When the 3 habits are full the limit sheet decides first; the toast says whether
 * its progress was kept or starts again (practice-core `restorePlan`). Returns false when blocked by the limit.
 */
export function restoreHabit(planId: string, today: string, habits: ReadonlyMap<string, PracticeHabit>, messages: { kept: string; reset: string }): boolean {
  const { store } = getPracticeSnapshot();
  if (habitAddChoice(store, today, limitOptions(habits)) !== null) return false;
  let reset = false;
  updateStore((s) => {
    const out = restorePlanInStore(s, planId, today);
    reset = out.reset;
    return out.store;
  });
  toast.success(reset ? messages.reset : messages.kept);
  return true;
}

/**
 * «أضف» with 3 habits (round 6, C-01d): it simply says you have 3 — archive one or delete one (two buttons per habit),
 * with the 3-day progress note. No «أكمل ما عندي» detour and no second «pause» concept. A place freed goes on
 * (`onFreed`); closing goes back.
 */
export function HabitLimitSheet({
  open,
  onOpenChange,
  store,
  today,
  habits,
  onFreed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store;
  today: string;
  habits: ReadonlyMap<string, PracticeHabit>;
  onFreed?: () => void;
}) {
  const t = useTranslations('practice.archive');
  const [archiving, setArchiving] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const choice = habitAddChoice(store, today, limitOptions(habits));
  const freed = () => {
    onFreed?.();
  };
  return (
    <>
      <Dialog open={open && choice !== null && archiving === null && deleting === null} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('limitTitle', { n: formatDigits(choice?.max ?? 3) })}</DialogTitle>
            <DialogDescription className="leading-7">
              {choice?.options.includes('archive') ? t('limitLead', { days: formatDigits(choice.resetDays) }) : t('limitLeadFull', { max: formatDigits(ARCHIVE_MAX) })}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {(choice?.candidates ?? []).map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
                <span className="min-w-0 text-base font-medium">
                  <PlanTitleText plan={plan} habits={habits} template={(title) => title} />
                </span>
                <ActionPair layout="hug">
                  {choice?.options.includes('archive') ? (
                    <Button size="sm" variant="outline" tone="primary" icon={<Archive aria-hidden />} onClick={() => setArchiving(plan)}>
                      {t('archiveOne')}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" tone="destructive" icon={<Trash2 aria-hidden />} onClick={() => setDeleting(plan)}>
                    {t('deleteOne')}
                  </Button>
                </ActionPair>
              </li>
            ))}
          </ul>
          <Button variant="outline" tone="neutral" className="self-start" onClick={() => onOpenChange(false)}>
            {t('back')}
          </Button>
        </DialogContent>
      </Dialog>
      <ArchiveDialog plan={archiving} store={store} today={today} habits={habits} onOpenChange={(o) => (o ? undefined : setArchiving(null))} onDone={freed} />
      <DeleteDialog plan={deleting} habits={habits} onOpenChange={(o) => (o ? undefined : setDeleting(null))} onDone={freed} />
    </>
  );
}

function PlanTitleText({ plan, habits, template }: { plan: Plan; habits: ReadonlyMap<string, PracticeHabit>; template: (title: string) => string }) {
  const words = usePlanWords(plan, habitOf(plan, habits));
  return <>{template(words.title)}</>;
}
