'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/kit/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FetchedEvidence } from './EvidenceQuotes';

/**
 * A small bordered «الدليل» button: the deed's evidence in a dialog, read from the API by Quote id (never typed here), the
 * same way a habit shows its texts. Fetched only when opened.
 */
export function EvidenceButton({ ids, deed }: { ids: readonly string[]; deed: string }) {
  const t = useTranslations('practice.evidenceButton');
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
            {/* The dialog names what the texts are for (O-05/W-05); the button keeps the short «الدليل» (F-04 a). */}
            <DialogTitle className="leading-8">{t('title')}</DialogTitle>
            <DialogDescription className="leading-7">{deed}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{open ? <FetchedEvidence ids={ids} /> : null}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
