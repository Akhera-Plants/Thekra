'use client';

import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface InfoTipProps {
  /** The details, shown on demand (owner, 2026-11-01: as little text as possible on the page itself). */
  children: ReactNode;
  /** Names what the details are about, for screen readers (defaults to «مزيد من التوضيح»). */
  label?: string;
  className?: string;
}

/** A small «؟» button that opens a short explanation in a popover (Escape and an outside tap close it). */
export function InfoTip({ children, label, className }: InfoTipProps) {
  const t = useTranslations('infoTip');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? t('label')}
          className={cn(
            'touch-44 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            className,
          )}
        >
          <CircleHelp className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-3.5 text-sm leading-7">
        {children}
      </PopoverContent>
    </Popover>
  );
}
