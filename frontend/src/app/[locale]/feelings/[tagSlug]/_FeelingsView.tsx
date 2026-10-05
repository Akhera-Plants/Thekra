'use client';

import { useTranslations } from 'next-intl';
import { ArabicText } from '@/components/shared/ArabicText';
import { InfiniteQuoteList } from '@/features/quran-hadith-browser/components/InfiniteQuoteList';
import { useTag } from '@/features/quran-hadith-browser/hooks/useTags';

interface FeelingsViewProps {
  tagSlug: string;
}

export function FeelingsView({ tagSlug }: FeelingsViewProps) {
  const t = useTranslations('feelings');
  const { data: tagData } = useTag(tagSlug);
  const tag = tagData?.data;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        {tag?.nameAr ? (
          <ArabicText as="h1" size="xl" className="font-semibold">
            {tag.nameAr}
          </ArabicText>
        ) : (
          <h1 className="text-2xl font-semibold">
            {t('pageTitle', { tag: tag?.name ?? tagSlug })}
          </h1>
        )}
      </header>
      <InfiniteQuoteList params={{ tag: [tagSlug], limit: 10 }} />
    </div>
  );
}
