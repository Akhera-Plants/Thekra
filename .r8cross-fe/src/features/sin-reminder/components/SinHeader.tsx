'use client';

import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import type { SinDto } from '@/lib/types/api';
import { ArabicText } from '@/components/shared/ArabicText';
import { SinRankBadge } from '@/components/shared/SinRankBadge';

interface SinHeaderProps {
  sin: Pick<SinDto, 'name' | 'nameAr' | 'rank' | 'descriptionAr' | 'description'>;
  /** Translated كبيرة / صغيرة. Omitted when the sin has no rank. */
  rankLabel?: string;
  className?: string;
}

export function SinHeader({ sin, rankLabel, className }: SinHeaderProps) {
  const locale = useLocale();
  const arabic = locale === 'ar';
  const title = arabic ? sin.nameAr : (sin.name || sin.nameAr);
  const description = arabic ? sin.descriptionAr : (sin.description || sin.descriptionAr);
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
      <div className="flex flex-wrap items-center gap-2">
        {!arabic && sin.name && sin.nameAr && sin.name !== sin.nameAr ? (
          <span dir="rtl" lang="ar" className="font-arabic-ui text-sm text-muted-foreground">
            {sin.nameAr}
          </span>
        ) : null}
        {sin.rank && rankLabel && (
          <SinRankBadge rank={sin.rank} label={rankLabel} />
        )}
      </div>
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
