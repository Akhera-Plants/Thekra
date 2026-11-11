'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Direction } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createQueryClient } from '@/lib/query-client';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createQueryClient());
  // Radix primitives (tabs, menus, popovers, sheets) default to LTR and write their own
  // `dir` attribute. Read the direction from the active locale on every render so it flips
  // with a client-side language switch instead of keeping the first page's direction.
  const dir = useLocale() === 'ar' ? 'rtl' : 'ltr';
  const tFeedback = useTranslations('feedback');

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Direction.Provider dir={dir}>
          <TooltipProvider>
            {children}
            {/* Save feedback («حُفظ …»): one toaster for the whole site, in the page's direction. */}
            {/* Its region is named in the page language (sonner's default «Notifications alt+T» is English on /). */}
            <Toaster position="bottom-center" dir={dir} customAriaLabel={tFeedback('toastsLabel')} />
          </TooltipProvider>
        </Direction.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
