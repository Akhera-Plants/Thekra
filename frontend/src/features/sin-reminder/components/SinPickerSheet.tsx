'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIntentSessionStore } from '@/features/sin-reminder/stores/session-intent.store';
import type { SinDto } from '@/lib/types/api';
import { SinSearchCommand } from './SinSearchCommand';

interface SinPickerSheetProps {
  /** Translated trigger label, e.g. "أشعر برغبة في معصية" */
  triggerLabel: string;
  /** Optional description shown below the trigger label */
  triggerDescription?: string;
  className?: string;
}

/**
 * Sheet (bottom drawer) that opens the sin search.
 * Navigates to `/sins/[slug]` on selection and records last-viewed in the store.
 */
export function SinPickerSheet({
  triggerLabel,
  triggerDescription,
  className,
}: SinPickerSheetProps) {
  const t = useTranslations('sins');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const setLastViewedSin = useIntentSessionStore((s) => s.setLastViewedSin);

  function handleSelect(sin: SinDto) {
    setLastViewedSin(sin.slug);
    setOpen(false);
    router.push(`/sins/${sin.slug}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={className}
        >
          <span className="flex flex-col items-start gap-0.5 text-start">
            <span className="font-semibold">{triggerLabel}</span>
            {triggerDescription && (
              <span className="text-xs font-normal text-muted-foreground">
                {triggerDescription}
              </span>
            )}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[80vh] flex-col rounded-t-xl p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-start">{t('openPicker')}</SheetTitle>
          <SheetDescription className="sr-only">
            {triggerDescription ?? triggerLabel}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <SinSearchCommand onSelect={handleSelect} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
