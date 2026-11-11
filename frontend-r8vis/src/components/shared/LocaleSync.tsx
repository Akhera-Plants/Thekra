'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';
import { setApiLocale } from '@/lib/api-client';
import type { LocaleCode } from '@/lib/types/enums';

/** Keeps the axios `lang` injector in sync with the active UI locale. */
export function LocaleSync() {
  const locale = useLocale();

  useEffect(() => {
    setApiLocale(locale as LocaleCode);
  }, [locale]);

  return null;
}
