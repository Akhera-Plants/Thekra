'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiPost } from '@/lib/api-client';

const REASONS = ['TEXT', 'ISNAD', 'GRADE', 'CLASSIFICATION', 'OTHER'] as const;

export function ReportMistake({ quoteId }: { quoteId: string }) {
  const t = useTranslations('quote');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('TEXT');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  if (sent) {
    return <p className="text-sm text-muted-foreground">{t('reportSent')}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="min-h-11 text-sm text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setOpen(true)}
      >
        {t('report')}
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void apiPost(`/quotes/${quoteId}/reports`, { reason, note: note.trim() || undefined })
          .then(() => setSent(true))
          .finally(() => setPending(false));
      }}
    >
      <label className="flex flex-col gap-1">
        <span>{t('reportReason')}</span>
        <select
          className="min-h-11 rounded-md border border-border bg-background px-2"
          value={reason}
          onChange={(event) => setReason(event.target.value as (typeof REASONS)[number])}
        >
          {REASONS.map((item) => (
            <option key={item} value={item}>
              {t(`reportReasons.${item}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('reportNote')}</span>
        <textarea
          className="min-h-20 rounded-md border border-border bg-background px-2 py-2"
          maxLength={400}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button type="submit" className="min-h-11 self-start underline-offset-2 hover:underline" disabled={pending}>
        {t('reportSend')}
      </button>
    </form>
  );
}
