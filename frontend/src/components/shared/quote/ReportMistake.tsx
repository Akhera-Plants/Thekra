'use client';

import { useId, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiPost } from '@/lib/api-client';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { failureKey, reportFailure } from '@/lib/errors';

const REASONS = ['TEXT', 'ISNAD', 'GRADE', 'CLASSIFICATION', 'OTHER'] as const;

const FIELD =
  'min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:border-primary focus-visible:outline-none md:text-sm';

/**
 * «أبلغ عن خطأ» as a dialog (W-04): opened from the text card's «⋯» menu, never a button under each text. One primary
 * «أرسل البلاغ» beside «إلغاء»; after sending, a thank-you and «تم» in the same dialog.
 */
export function ReportMistakeDialog({
  quoteId,
  open,
  onOpenChange,
}: {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('quote');
  const tFeedback = useTranslations('feedback');
  const id = useId();
  const [reason, setReason] = useState<(typeof REASONS)[number]>('TEXT');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function change(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Fresh form the next time it opens.
      setSent(false);
      setNote('');
      setReason('TEXT');
      setFailure(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-start gap-4" role="status">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 aria-hidden className="size-5 text-primary-text" />
                {t('reportThanksTitle')}
              </DialogTitle>
              <DialogDescription>{t('reportSent')}</DialogDescription>
            </DialogHeader>
            <Button variant="solid" tone="primary" size="md" className="w-full sm:w-auto" onClick={() => change(false)}>
              {t('reportDone')}
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPending(true);
              setFailure(null);
              void apiPost(`/quotes/${quoteId}/reports`, { reason, note: note.trim() || undefined })
                .then(() => setSent(true))
                .catch((error: unknown) => {
                  reportFailure('quote report', error);
                  setFailure(tFeedback(`error.${failureKey(error)}`));
                })
                .finally(() => setPending(false));
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('report')}</DialogTitle>
              <DialogDescription>{t('reportLead')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-reason`} className="text-sm font-medium">
                {t('reportReason')}
              </label>
              <select
                id={`${id}-reason`}
                className={FIELD}
                value={reason}
                onChange={(event) => setReason(event.target.value as (typeof REASONS)[number])}
              >
                {REASONS.map((item) => (
                  <option key={item} value={item}>
                    {t(`reportReasons.${item}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-note`} className="text-sm font-medium">
                {t('reportNote')}
              </label>
              <textarea
                id={`${id}-note`}
                className={`${FIELD} min-h-24 py-2`}
                maxLength={400}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            {failure ? (
              <p className="text-sm text-destructive" role="alert">
                {failure}
              </p>
            ) : null}
            <ActionPair>
              <Button type="submit" variant="solid" tone="primary" size="md" loading={pending}>
                {t('reportSend')}
              </Button>
              <Button type="button" variant="outline" tone="neutral" size="md" onClick={() => change(false)}>
                {t('reportCancel')}
              </Button>
            </ActionPair>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
