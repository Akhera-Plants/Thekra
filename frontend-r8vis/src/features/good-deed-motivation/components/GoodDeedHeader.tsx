'use client';

import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import type { GoodDeedDto } from '@/lib/types/api';
import { ArabicText } from '@/components/shared/ArabicText';

interface GoodDeedHeaderProps {
  goodDeed: Pick<
    GoodDeedDto,
    'name' | 'nameAr' | 'descriptionAr' | 'description'
  >;
  className?: string;
}

export function GoodDeedHeader({ goodDeed, className }: GoodDeedHeaderProps) {
  const locale = useLocale();
  const arabic = locale === 'ar';
  const title = arabic ? goodDeed.nameAr : (goodDeed.name || goodDeed.nameAr);
  const description = arabic
    ? goodDeed.descriptionAr
    : (goodDeed.description || goodDeed.descriptionAr);
  const titleArabic = /[\u0600-\u06FF]/.test(title);

  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {titleArabic ? (
        <ArabicText as="h1" size="xl" className="font-semibold">
          {title}
        </ArabicText>
      ) : (
        <h1 className="text-xl font-semibold">{title}</h1>
      )}
      {!arabic && goodDeed.name && goodDeed.nameAr && goodDeed.name !== goodDeed.nameAr ? (
        <span dir="rtl" lang="ar" className="font-arabic-ui text-sm text-muted-foreground">
          {goodDeed.nameAr}
        </span>
      ) : null}
      {description ? (
        /[\u0600-\u06FF]/.test(description) ? (
          <ArabicText size="base" className="text-muted-foreground">
            {description}
          </ArabicText>
        ) : (
          <p className="text-sm text-muted-foreground">{description}</p>
        )
      ) : null}
    </header>
  );
}
