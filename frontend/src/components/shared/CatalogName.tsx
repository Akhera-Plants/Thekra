'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { ArabicText } from '@/components/shared/ArabicText';

interface CatalogNameProps {
  nameAr: string;
  name?: string | null;
  badge?: ReactNode;
}

/** Primary label follows the UI language. Arabic stays the fallback. */
export function CatalogName({ nameAr, name, badge }: CatalogNameProps) {
  const locale = useLocale();
  const arabic = locale === 'ar';
  const label = arabic ? nameAr : (name || nameAr);
  const labelArabic = /[\u0600-\u06FF]/.test(label);

  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {labelArabic ? (
          <ArabicText as="span" size="base" className="min-w-0">
            {label}
          </ArabicText>
        ) : (
          <span className="min-w-0 font-medium">{label}</span>
        )}
        {badge}
      </span>
      {!arabic && name && nameAr && name !== nameAr ? (
        <span dir="rtl" lang="ar" className="font-arabic-ui text-sm text-muted-foreground">
          {nameAr}
        </span>
      ) : null}
    </span>
  );
}
