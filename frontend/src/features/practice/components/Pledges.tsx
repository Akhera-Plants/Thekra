'use client';

import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  addPledge,
  PLEDGE_DEED_INFO,
  pledgeEvidence,
  removePledge,
  type HeartData,
  type Plan,
  type PledgeAction,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { updateHeart } from '@/lib/practice/heart-store';
import { newUuid } from '@/lib/practice/ids';
import { isPeriodicTemplate } from '@/lib/practice/limits';
import { habitOf } from '@/lib/practice/plans';
import { pledgeText, quotedTitle } from '@/lib/practice/pledges';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { FetchedEvidence } from './EvidenceQuotes';
import { planTitle } from './hub/HeartCards';

/** The habits a pledge can be tied to: every plan except the periodic acts (reminders, never habits). */
export function pledgeablePlans(plans: readonly Plan[], habits: ReadonlyMap<string, PracticeHabit>): Plan[] {
  return plans.filter((p) => !isPeriodicTemplate(habitOf(p, habits)));
}

/**
 * A small bordered «الدليل» button: the deed's evidence in a dialog, read from the API by Quote id (never typed here), the
 * same way a habit shows its texts. Fetched only when opened.
 */
export function EvidenceButton({ ids, deed }: { ids: readonly string[]; deed: string }) {
  const t = useTranslations('practice.pledges');
  const [open, setOpen] = useState(false);
  if (ids.length === 0) return null;
  return (
    <>
      <Button
        variant="outline"
        tone="neutral"
        size="sm"
        className="shrink-0 px-3 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground"
        aria-label={t('evidenceOf', { deed })}
        onClick={() => setOpen(true)}
      >
        {t('evidence')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('evidence')}</DialogTitle>
            <DialogDescription className="leading-7">{deed}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{open ? <FetchedEvidence ids={ids} /> : null}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PledgeDialogProps {
  plan: Plan;
  heart: HeartData;
  habits: ReadonlyMap<string, PracticeHabit>;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One habit's «التزام شخصي»: «إن فاتتني يومين متتاليين:» a listed deed (each with «الدليل»), «أتصدق بـ…» with an amount,
 * or «نص أكتبه». «احفظ» saves, closes and says so; an existing pledge can be removed here (with a confirmation).
 */
export function PledgeDialog({ plan, heart, habits, today, open, onOpenChange }: PledgeDialogProps) {
  const t = useTranslations('practice.pledges');
  const english = useLocale() === 'en';
  const existing = heart.pledges.find((p) => p.planId === plan.id);
  const habit = quotedTitle(planTitle(plan, habits, english), english);
  const [action, setAction] = useState<PledgeAction | null>(existing?.action ?? null);
  const [amount, setAmount] = useState(existing?.action === 'sadaqah' ? (existing.text ?? '') : '');
  const [text, setText] = useState(existing?.action === 'custom' ? (existing.text ?? '') : '');
  const [confirming, setConfirming] = useState(false);
  const name = useId();
  const amountId = useId();
  const textId = useId();
  const canSave = action !== null && (action !== 'custom' || text.trim() !== '');

  function save() {
    if (!action || !canSave) return;
    const line = action === 'sadaqah' ? amount : action === 'custom' ? text : undefined;
    updateHeart((h) => addPledge(h, { id: existing?.id ?? newUuid(), planId: plan.id, action, text: line, createdOn: existing?.createdOn ?? today }));
    onOpenChange(false);
    toast.success(t('saved', { habit }));
  }

  function remove() {
    if (!existing) return;
    updateHeart((h) => removePledge(h, existing.id));
    setConfirming(false);
    onOpenChange(false);
    toast.success(t('removed', { habit }));
  }

  const option = (key: PledgeAction, label: string) => (
    <li key={key} className="flex items-center gap-2 py-1">
      <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm leading-6">
        <input type="radio" name={name} className="size-4 shrink-0 accent-primary" checked={action === key} onChange={() => setAction(key)} />
        <span>{label}</span>
      </label>
      <EvidenceButton ids={pledgeEvidence(key)} deed={label} />
    </li>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border p-4 pe-12">
            <DialogTitle className="text-lg leading-8">{t('dialogTitle', { habit })}</DialogTitle>
            <DialogDescription className="leading-7">{t('dialogIf')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
            <ul role="radiogroup" aria-label={t('dialogIf')} className="flex flex-col divide-y divide-border">
              {PLEDGE_DEED_INFO.map((d) => option(d.key, english ? d.titleEn : d.titleAr))}
              {option('sadaqah', t('sadaqah'))}
              {action === 'sadaqah' ? (
                <li className="flex flex-col gap-1 pb-3 ps-8">
                  <label htmlFor={amountId} className="text-sm text-muted-foreground">
                    {t('amount')}
                  </label>
                  <Input id={amountId} className="h-11" maxLength={140} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </li>
              ) : null}
              <li className="py-1">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm leading-6">
                  <input type="radio" name={name} className="size-4 shrink-0 accent-primary" checked={action === 'custom'} onChange={() => setAction('custom')} />
                  <span>{t('custom')}</span>
                </label>
              </li>
              {action === 'custom' ? (
                <li className="flex flex-col gap-1 pb-3 ps-8">
                  <label htmlFor={textId} className="text-sm text-muted-foreground">
                    {t('text')}
                  </label>
                  <Input id={textId} className="h-11" maxLength={140} value={text} onChange={(e) => setText(e.target.value)} />
                </li>
              ) : null}
            </ul>
          </div>
          <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border p-4 sm:justify-between">
            <Button disabled={!canSave} onClick={save}>
              {t('save')}
            </Button>
            {existing ? (
              <Button variant="outline" tone="destructive" onClick={() => setConfirming(true)}>
                {t('remove')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeTitle', { habit })}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" tone="neutral" onClick={() => setConfirming(false)}>
              {t('keep')}
            </Button>
            <Button tone="destructive" onClick={remove}>
              {t('removeConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** «إن فاتتني يومين: <deed>», or a small bordered «اختر عملًا»; the whole row opens the habit's dialog. */
function PledgeLine({ plan, heart, english, onOpen, label }: { plan: Plan; heart: HeartData; english: boolean; onOpen: () => void; label?: string }) {
  const t = useTranslations('practice.pledges');
  const tPledge = useTranslations('practice.heart.pledge');
  const pledge = heart.pledges.find((p) => p.planId === plan.id);
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        {label ? <span className="text-base font-medium">{label}</span> : null}
        {pledge ? (
          <span className="text-sm leading-7 text-muted-foreground">{t('row', { deed: pledgeText(pledge, english, tPledge) })}</span>
        ) : null}
      </div>
      {pledge ? (
        <Button variant="outline" tone="primary" size="sm" onClick={onOpen}>
          {t('edit')}
        </Button>
      ) : (
        <Button variant="outline" tone="primary" size="sm" icon={<Plus aria-hidden />} onClick={onOpen}>
          {t('choose')}
        </Button>
      )}
    </div>
  );
}

interface PledgeListProps {
  plans: readonly Plan[];
  heart: HeartData;
  habits: ReadonlyMap<string, PracticeHabit>;
  today: string;
}

/** Every habit, one row each (parted by lines), with its own make-up deed. */
export function PledgeList({ plans, heart, habits, today }: PledgeListProps) {
  const t = useTranslations('practice.pledges');
  const english = useLocale() === 'en';
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = pledgeablePlans(plans, habits);
  const openPlan = rows.find((p) => p.id === openId);
  if (rows.length === 0) return <p className="text-muted-foreground">{t('noHabits')}</p>;
  return (
    <>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {rows.map((plan) => (
          <li key={plan.id} className={cn('flex items-center gap-3 py-3')}>
            <PledgeLine plan={plan} heart={heart} english={english} label={planTitle(plan, habits, english)} onOpen={() => setOpenId(plan.id)} />
          </li>
        ))}
      </ul>
      {openPlan ? (
        <PledgeDialog
          key={openPlan.id}
          plan={openPlan}
          heart={heart}
          habits={habits}
          today={today}
          open
          onOpenChange={(open) => (open ? undefined : setOpenId(null))}
        />
      ) : null}
    </>
  );
}

/** «التزامي» on a habit's card (when «التزام شخصي» is on): its pledge, and the same dialog. */
export function HabitPledgeRow({ plan, heart, habits, today }: Omit<PledgeListProps, 'plans'> & { plan: Plan }) {
  const t = useTranslations('practice.pledges');
  const english = useLocale() === 'en';
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <PledgeLine plan={plan} heart={heart} english={english} label={t('mine')} onOpen={() => setOpen(true)} />
      {open ? <PledgeDialog plan={plan} heart={heart} habits={habits} today={today} open onOpenChange={setOpen} /> : null}
    </div>
  );
}
