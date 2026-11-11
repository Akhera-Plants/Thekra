'use client';

import { useId, useState } from 'react';
import { Check, Wrench } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  addDays,
  canMakeUp,
  chooseMakeUp,
  HEART_LINE_MAX,
  logForDay,
  MAKE_UP_TEXTS,
  markMakeUpDone,
  pledgeDeedInfo,
  pledgeEvidence,
  requiredOn,
  updatePlan,
  type MakeUpDeed,
  type MakeUpOffer,
  type Plan,
  type PledgeAction,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { updateHeart } from '@/lib/practice/heart-store';
import { updateStore } from '@/lib/practice/local-store';
import { cn } from '@/lib/utils';
import { EvidenceButton } from '../EvidenceButton';

/** A make-up action's words in the page language (the deed titles are shared with the app, `pledge-deeds.ts`). */
export function useMakeUpTitle() {
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  return (action: PledgeAction, text?: string): string => {
    if (action === 'custom') return text ?? MAKE_UP_TEXTS[lang].custom;
    if (action === 'sadaqah') return text ? `${MAKE_UP_TEXTS[lang].sadaqah}: ${text}` : MAKE_UP_TEXTS[lang].sadaqah;
    const info = pledgeDeedInfo(action);
    return info ? (lang === 'en' ? info.titleEn : info.titleAr) : action;
  };
}

interface FixButtonProps {
  plan: Plan;
  title: string;
  today: string;
  /** Two asked days missed in a row (practice-core `makeUpOffer`), or null. */
  offer: MakeUpOffer | null;
  /** Yesterday was asked and missed (the «لا تفوّتها مرتين» part). */
  missedYesterday: boolean;
  /** «أقل ما يمكن»: logs today's smallest amount; absent when nothing is left to add. */
  onMinimum?: () => void;
}

/**
 * «صلّحها» on a habit row (round 5, F-08 a / F-12 a): one bordered button that opens a dialog. After two missed asked
 * days: «أتبع السيئة الحسنة: اختر عملًا واحدًا اليوم» with the shared deeds (each with «المعينات»), a sadaqah and a deed
 * of one's own. After one missed day: «لا تفوّتها مرتين» with the pair «سجّل أقل ما يمكن اليوم» · «اقضِ ما فاتك»
 * (yesterday, while its window is open). A choice saves, closes and says so.
 */
export function FixButton({ plan, title, today, offer, missedYesterday, onMinimum }: FixButtonProps) {
  const t = useTranslations('practice.hub.fix');
  const [open, setOpen] = useState(false);
  const yesterday = addDays(today, -1);
  const canMakeUpYesterday = missedYesterday && canMakeUp(yesterday, today) && (plan.log[yesterday] ?? 0) === 0;
  const hasRepair = Boolean(onMinimum) || canMakeUpYesterday;
  if (!offer && !hasRepair) return null;

  return (
    <>
      <Button variant="outline" tone="primary" size="sm" icon={<Wrench aria-hidden />} onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('open')}</DialogTitle>
            <DialogDescription className="leading-7">{title}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pe-1">
            {offer && !offer.chosen ? (
              <MakeUpChooser
                offer={offer}
                today={today}
                onChosen={(label) => {
                  setOpen(false);
                  toast.success(t('chosen', { deed: label }));
                }}
              />
            ) : null}
            {hasRepair ? (
              <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-medium">{t('title')}</h3>
                  <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
                </div>
                <ActionPair>
                  {onMinimum ? (
                    <Button
                      tone="primary"
                      className="h-auto min-h-11 whitespace-normal py-2"
                      onClick={() => {
                        onMinimum();
                        setOpen(false);
                        toast.success(t('minimumDone'));
                      }}
                    >
                      {t('minimum')}
                    </Button>
                  ) : null}
                  {canMakeUpYesterday ? (
                    <Button
                      variant={onMinimum ? 'outline' : 'solid'}
                      tone="primary"
                      className="h-auto min-h-11 whitespace-normal py-2"
                      onClick={() => {
                        updateStore((s) => updatePlan(s, plan.id, (p) => logForDay(p, yesterday, Math.max(1, requiredOn(p, yesterday)), today)));
                        setOpen(false);
                        toast.success(t('madeUp'));
                      }}
                    >
                      {t('makeUp')}
                    </Button>
                  ) : null}
                </ActionPair>
              </section>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const DEEDS_WITH_TEXT: readonly PledgeAction[] = ['sadaqah', 'custom'];

function MakeUpChooser({ offer, today, onChosen }: { offer: MakeUpOffer; today: string; onChosen: (label: string) => void }) {
  const tFix = useTranslations('practice.hub.fix');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const words = MAKE_UP_TEXTS[lang];
  const titleOf = useMakeUpTitle();
  const [action, setAction] = useState<PledgeAction | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const textId = useId();
  const name = useId();

  function choose() {
    if (!action) return;
    const line = text.trim();
    if (action === 'custom' && !line) {
      setError(true);
      return;
    }
    updateHeart((h) =>
      chooseMakeUp(h, { planId: offer.planId, on: offer.on, date: today, action, ...(DEEDS_WITH_TEXT.includes(action) && line ? { text: line } : {}) }),
    );
    onChosen(titleOf(action, DEEDS_WITH_TEXT.includes(action) && line ? line : undefined));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium">{words.title}</h3>
        <p className="text-sm leading-7 text-muted-foreground">{words.prompt}</p>
      </div>
      <fieldset className="flex flex-col">
        <legend className="sr-only">{words.prompt}</legend>
        <ul className="flex flex-col divide-y divide-border border-b border-border">
          {offer.actions.map((key) => {
            const label = key === 'sadaqah' ? words.sadaqah : key === 'custom' ? words.custom : titleOf(key);
            return (
              <li key={key} className="flex items-center gap-2 py-1">
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1">
                  <input
                    type="radio"
                    name={name}
                    className="size-4 shrink-0 accent-primary"
                    checked={action === key}
                    onChange={() => {
                      setAction(key);
                      setError(false);
                    }}
                  />
                  <span className="text-sm leading-6">{label}</span>
                </label>
                <EvidenceButton ids={pledgeEvidence(key)} deed={label} />
              </li>
            );
          })}
        </ul>
      </fieldset>
      {action && DEEDS_WITH_TEXT.includes(action) ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={textId} className="text-sm font-medium">
            {action === 'custom' ? tFix('customLabel') : tFix('sadaqahLabel')}
          </label>
          <Input
            id={textId}
            value={text}
            maxLength={HEART_LINE_MAX}
            aria-invalid={error || undefined}
            aria-describedby={error ? `${textId}-error` : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setError(false);
            }}
            className="h-11"
          />
          {error ? (
            <p id={`${textId}-error`} role="alert" className="text-sm text-destructive">
              {tFix('customRequired')}
            </p>
          ) : null}
        </div>
      ) : null}
      <Button className="self-start" disabled={!action} onClick={choose}>
        {tFix('choose')}
      </Button>
    </section>
  );
}

/** The deed chosen in «صلّحها», under its habit's row on the day it was chosen: its words and «فعلته». */
export function ChosenMakeUp({ deed }: { deed: MakeUpDeed }) {
  const tFix = useTranslations('practice.hub.fix');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const titleOf = useMakeUpTitle();
  const done = deed.done === true;
  return (
    <div className="flex flex-wrap items-center gap-2 ps-[3.25rem] text-sm leading-7">
      <span className="text-muted-foreground">{tFix('today', { deed: titleOf(deed.action, deed.text) })}</span>
      <button
        type="button"
        aria-pressed={done}
        onClick={() => updateHeart((h) => markMakeUpDone(h, deed.planId, deed.on, !done))}
        className={cn(
          'touch-44 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
          done ? 'border-primary bg-secondary text-primary-text' : 'border-border hover:bg-muted',
        )}
      >
        {done ? <Check aria-hidden className="size-4" /> : null}
        {MAKE_UP_TEXTS[lang].done}
      </button>
    </div>
  );
}
