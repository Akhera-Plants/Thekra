'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';
import { QuoteCard, QuoteCardSkeleton } from '@/components/shared/quote';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ArabicText } from '@/components/shared/ArabicText';
import { useSurahAyahs } from '@/features/quran-hadith-browser/hooks/useSurahs';
import type { SurahDto } from '@/lib/types/api';

interface SurahViewProps {
  surah: SurahDto;
}

export function SurahView({ surah }: SurahViewProps) {
  const tSurah = useTranslations('surah');
  const tEmpty = useTranslations('emptyState');
  const tError = useTranslations('errorState');

  const { data, isPending, isError, refetch } = useSurahAyahs(surah.number);
  const ayahs = data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <ArabicText as="h1" size="xl" className="font-semibold">
            {surah.nameAr}
          </ArabicText>
          <p className="text-sm text-muted-foreground">
            {tSurah('ayahCount', { count: surah.ayahCount })}
          </p>
        </div>
        <Link
          href="/browse?tab=quran"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-[opacity] duration-150 ease-out rtl:-scale-x-100"
          aria-label={tSurah('back')}
        >
          <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
          {tSurah('back')}
        </Link>
      </header>

      {isPending && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <QuoteCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState
          message={tError('default')}
          retryLabel={tError('retry')}
          onRetry={() => refetch()}
        />
      )}

      {!isPending && !isError && ayahs.length === 0 && (
        <EmptyState message={tEmpty('noQuotes')} />
      )}

      {!isPending && ayahs.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label={surah.nameAr}>
          {ayahs.map((ayah) => (
            <li key={ayah.id}>
              <QuoteCard
                quote={ayah}
                detailHref={`/quotes/${ayah.id}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
