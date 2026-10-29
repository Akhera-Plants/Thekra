'use client';

import { useEffect, useState } from 'react';
import { Wind, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SinProgram } from '@thekra/practice-core';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/shared/kit/button';
import { formatDigits } from '@/lib/format/digits';
import type { QuoteDto } from '@/lib/types/api';
import type { SinProgramCommon, SinProgramEntry, UrgeMoment } from '@/lib/types/practice';
import { UrgeSteps } from './UrgeSteps';

const MINUTE_MS = 60_000;

interface UrgeMomentDialogProps {
  program: SinProgram;
  entry: SinProgramEntry;
  urge: UrgeMoment;
  common: SinProgramCommon;
  quotes: readonly QuoteDto[];
  today: string;
}

/**
 * «أشعر بضعف الآن» (docs/plan/2026-10-tazkiya-tracker-proposals.md item 3): opens about 90 calm seconds in a dialog
 * whose title is generic («وقفة»). «أجّل عشر دقائق» checks back once on this page (no notification on the web).
 * Nothing leaves the browser; the texts are the evidence already fetched for every program.
 */
export function UrgeMomentDialog({ program, entry, urge, common, quotes, today }: UrgeMomentDialogProps) {
  const t = useTranslations('leaveSin.urge');
  const [open, setOpen] = useState(false);
  const [checkBackAt, setCheckBackAt] = useState<number | null>(null);
  const [checkBackDue, setCheckBackDue] = useState(false);

  useEffect(() => {
    if (checkBackAt === null) return;
    const timer = window.setTimeout(() => {
      setCheckBackAt(null);
      setCheckBackDue(true);
    }, Math.max(0, checkBackAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [checkBackAt]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setCheckBackDue(false);
  }

  function handleDelay(minutes: number) {
    setCheckBackAt(Date.now() + minutes * MINUTE_MS);
  }

  return (
    <section className="flex flex-col items-start gap-2" aria-label={t('button')}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <button type="button" className="solid-button button-wrap">
            <Wind className="size-4" aria-hidden />
            {t('button')}
          </button>
        </DialogTrigger>
        <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-lg">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="eyebrow">{t('screenTitle')}</DialogTitle>
            <Button variant="ghost" tone="neutral" size="sm" iconOnly onClick={() => setOpen(false)} aria-label={t('close')}>
              <X aria-hidden />
            </Button>
          </div>
          <DialogDescription className="sr-only">{t('buttonHint')}</DialogDescription>
          <UrgeSteps
            program={program}
            entry={entry}
            urge={urge}
            common={common}
            quotes={quotes}
            today={today}
            onDelay={handleDelay}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <p className="text-sm leading-7 text-muted-foreground">{t('buttonHint')}</p>
      {checkBackDue ? (
        <p className="next-step !mt-0" role="status">
          {t('checkBack', { minutes: formatDigits(urge.delay.minutes) })}
        </p>
      ) : null}
    </section>
  );
}
