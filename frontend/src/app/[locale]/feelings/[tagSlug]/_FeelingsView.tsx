'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArabicText } from '@/components/shared/ArabicText';
import { InfiniteQuoteList } from '@/features/quran-hadith-browser/components/InfiniteQuoteList';
import { useTag } from '@/features/quran-hadith-browser/hooks/useTags';

interface FeelingsViewProps {
  tagSlug: string;
}

export function FeelingsView({ tagSlug }: FeelingsViewProps) {
  const t = useTranslations('feelings');
  const locale = useLocale();
  const arabic = locale === 'ar';
  const { data: tagData } = useTag(tagSlug);
  const tag = tagData?.data;
  const title = arabic ? (tag?.nameAr || tag?.name) : (tag?.name || tag?.nameAr);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        {title && /[\u0600-\u06FF]/.test(title) ? (
          <ArabicText as="h1" size="xl" className="font-semibold">
            {title}
          </ArabicText>
        ) : title ? (
          <h1 className="text-2xl font-semibold">{title}</h1>
        ) : (
          <h1 className="text-2xl font-semibold">
            {t('pageTitle', { tag: tagSlug })}
          </h1>
        )}
      </header>
      <InfiniteQuoteList params={{ tag: [tagSlug], limit: 10 }} />
    </div>
  );
}
