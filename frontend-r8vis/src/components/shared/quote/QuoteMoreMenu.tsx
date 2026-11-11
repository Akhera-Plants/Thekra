'use client';

import { useState } from 'react';
import { Flag, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/kit/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ReportMistakeDialog } from './ReportMistake';

/**
 * The text card's «⋯» (W-04), beside share and save: the rare actions live here instead of under every text.
 * Today it holds «أبلغ عن خطأ», which opens {@link ReportMistakeDialog}.
 */
export function QuoteMoreMenu({ quoteId, className }: { quoteId: string; className?: string }) {
  const t = useTranslations('quote');
  const [reporting, setReporting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            tone="neutral"
            size="sm"
            iconOnly
            icon={<MoreHorizontal aria-hidden />}
            aria-label={t('more')}
            className={cn('size-11 text-muted-foreground hover:text-foreground', className)}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-48">
          <DropdownMenuItem className="min-h-11 gap-2.5 px-2.5 text-[15px]" onSelect={() => setReporting(true)}>
            <Flag aria-hidden />
            {t('report')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportMistakeDialog quoteId={quoteId} open={reporting} onOpenChange={setReporting} />
    </>
  );
}
