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
import type { GoodDeedDto } from '@/lib/types/api';
import { GoodDeedSearchCommand } from './GoodDeedSearchCommand';

interface GoodDeedPickerSheetProps {
  triggerLabel: string;
  triggerDescription?: string;
  className?: string;
}

export function GoodDeedPickerSheet({
  triggerLabel,
  triggerDescription,
  className,
}: GoodDeedPickerSheetProps) {
  const t = useTranslations('goodDeeds');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const setLastViewedDeed = useIntentSessionStore((s) => s.setLastViewedDeed);

  function handleSelect(deed: GoodDeedDto) {
    setLastViewedDeed(deed.slug);
    setOpen(false);
    router.push(`/good-deeds/${deed.slug}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className={className}>
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
          <GoodDeedSearchCommand onSelect={handleSelect} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
