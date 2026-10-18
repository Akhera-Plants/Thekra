'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bookmark } from 'lucide-react';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { StaggerReveal } from '@/components/shared/StaggerReveal';
import { QuoteCard } from '@/components/shared/quote/QuoteCard';
import { QuoteCardSkeleton } from '@/components/shared/quote/QuoteCardSkeleton';
import { useFavorites } from '../hooks/useFavorites';
import { useToggleFavorite } from '../hooks/useToggleFavorite';

export function FavoritesList() {
  const t = useTranslations();
  const { data, isLoading, isError, refetch } = useFavorites({ limit: 50 });
  const { toggle, isPending } = useToggleFavorite({
    labels: {
      added: t('favorites.added'),
      removed: t('favorites.removed'),
      error: t('favorites.error'),
      authRequired: t('favorites.authRequired'),
    },
  });

  if (isLoading) {
    return (
      <div className="saved-list" aria-busy="true">
        {[...Array(3)].map((_, i) => (
          <QuoteCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={t('errorState.default')}
        onRetry={refetch}
        retryLabel={t('errorState.retry')}
      />
    );
  }

  if (!data?.items.length) {
    return (
      <div className="saved-list">
        <div className="empty-state">
          <Bookmark className="size-[34px]" aria-hidden />
          <h2>{t('favorites.empty')}</h2>
          <p>{t('favorites.emptyHint')}</p>
          <Link className="solid-button" href="/#paths">
            {t('favorites.choosePath')} <DirectionalArrow className="size-[18px]" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-list" role="list">
      <StaggerReveal>
        {data.items.map((quote) => (
          <div key={quote.id} role="listitem" className="min-w-0">
            <QuoteCard
              quote={quote}
              detailHref={`/quotes/${quote.id}`}
              showFavoriteButton
              isFavoritePending={isPending}
              onToggleFavorite={toggle}
            />
          </div>
        ))}
      </StaggerReveal>
    </div>
  );
}
