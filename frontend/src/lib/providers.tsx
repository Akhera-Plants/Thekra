'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { Direction } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/shared/theme-provider';
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

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Direction.Provider dir={dir}>
          <TooltipProvider>{children}</TooltipProvider>
        </Direction.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
