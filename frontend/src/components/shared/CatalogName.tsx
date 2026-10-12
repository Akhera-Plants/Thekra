'use client';

import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { ArabicText } from '@/components/shared/ArabicText';

interface CatalogNameProps {
  nameAr: string;
  name?: string | null;
  badge?: ReactNode;
}

/**
 * A catalogue row reads downward: the Arabic name, then the English gloss.
 * A side-by-side pair fights for the row and reads as a generated table.
 */
export function CatalogName({ nameAr, name, badge }: CatalogNameProps) {
  const locale = useLocale();

  return (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <ArabicText as="span" size="base" className="min-w-0">
          {nameAr}
        </ArabicText>
        {badge}
      </span>
      {locale === 'en' && name ? (
        <span className="text-sm text-muted-foreground">{name}</span>
      ) : null}
    </span>
  );
}
