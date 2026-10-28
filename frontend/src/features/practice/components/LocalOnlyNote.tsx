'use client';

import { HardDrive, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LocalOnlyNoteProps {
  /** False when the browser refused storage (private window, blocked site data). */
  persistent: boolean;
}

/** Where the data lives: on this device only, or (when storage is refused) only until the tab closes. */
export function LocalOnlyNote({ persistent }: LocalOnlyNoteProps) {
  const t = useTranslations('practice.storage');
  return (
    <p className="flex items-start gap-2 text-sm leading-7 text-muted-foreground" role={persistent ? undefined : 'status'}>
      {persistent ? (
        <HardDrive className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
      ) : (
        <TriangleAlert className="mt-1 size-4 shrink-0 text-destructive" aria-hidden />
      )}
      <span>{persistent ? t('local') : t('memoryOnly')}</span>
    </p>
  );
}
