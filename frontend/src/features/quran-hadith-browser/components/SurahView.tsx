'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { StaggerReveal } from '@/components/shared/StaggerReveal';
import { QuoteCard, QuoteCardSkeleton } from '@/components/shared/quote';
import { EmptyState } from '@/components/shared/EmptyState';
import { QueryErrorState } from '@/components/shared/feedback/QueryErrorState';
import { ArabicText } from '@/components/shared/ArabicText';
import { useSurahAyahs } from '@/features/quran-hadith-browser/hooks/useSurahs';
import { useQuoteFavoriteProps } from '@/features/favorites/hooks/useQuoteFavoriteProps';
import type { SurahDto } from '@/lib/types/api';

interface SurahViewProps {
  surah: SurahDto;
}

export function SurahView({ surah }: SurahViewProps) {
  const tSurah = useTranslations('surah');
  const tEmpty = useTranslations('emptyState');
  const favoriteProps = useQuoteFavoriteProps();

  const { data, isPending, isError, error, refetch } = useSurahAyahs(surah.surahNumber);
  const ayahs = data?.data ?? [];
  // The title follows the page language: «Al-Fatihah» on /en, «الفاتحة» on /.
  const english = useLocale() === 'en' && Boolean(surah.surahName);
  const surahLabel = english
    ? (surah.surahName ?? '')
    : (surah.surahNameAr ?? surah.surahName ?? String(surah.surahNumber));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {english ? (
            <h1 className="text-2xl font-semibold">{surahLabel}</h1>
          ) : (
            <ArabicText as="h1" size="xl" className="font-semibold">
              {surahLabel}
            </ArabicText>
          )}
          <p className="text-sm text-muted-foreground">
            {tSurah('ayahCount', { count: surah.ayahCount })}
          </p>
        </div>
        <Link
          href="/browse?tab=quran"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-[opacity] duration-150 ease-out"
          aria-label={tSurah('back')}
        >
          {/* Back = the forward arrow turned around: ← in English, → in Arabic. The link
              itself is never mirrored (that mirrored its text). */}
          <DirectionalArrow className="size-4 -scale-x-100 rtl:scale-x-100" />
          {tSurah('back')}
        </Link>
      </header>

      {isPending && (
        <div className="flex flex-col gap-8 md:gap-9">
          {Array.from({ length: 5 }).map((_, i) => (
            <QuoteCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <QueryErrorState
          error={error}
          onRetry={() => void refetch()}
        />
      )}

      {!isPending && !isError && ayahs.length === 0 && (
        <EmptyState message={tEmpty('noQuotes')} />
      )}

      {!isPending && ayahs.length > 0 && (
        <div className="flex flex-col gap-8 md:gap-9" role="list" aria-label={surahLabel}>
          <StaggerReveal>
            {ayahs.map((ayah) => (
              <div key={ayah.id} role="listitem" className="min-w-0">
                <QuoteCard
                  quote={ayah}
                  detailHref={`/quotes/${ayah.id}`}
                  {...favoriteProps(ayah)}
                />
              </div>
            ))}
          </StaggerReveal>
        </div>
      )}
    </div>
  );
}
