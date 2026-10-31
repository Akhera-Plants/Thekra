'use client';

import { useTranslations } from 'next-intl';
import type { QuoteCardProps } from '@/components/shared/quote/QuoteCard';
import { accountsEnabled } from '@/lib/accounts';
import type { QuoteDto } from '@/lib/types/api';
import { useFavoriteQuoteIds } from './useFavoriteQuoteIds';
import { useToggleFavorite } from './useToggleFavorite';

type FavoriteProps = Pick<QuoteCardProps, 'showFavoriteButton' | 'isFavorite' | 'onToggleFavorite' | 'isFavoritePending'>;

/**
 * The save mark for reader QuoteCards (topic pages, surah, browse), so «اضغط علامة الحفظ بجانب أي نص» holds.
 * Returns the props per quote; nothing when accounts are off. A guest pressing it is asked to sign in.
 */
export function useQuoteFavoriteProps(): (quote: QuoteDto) => FavoriteProps {
  const t = useTranslations('favorites');
  const enabled = accountsEnabled();
  const { ids } = useFavoriteQuoteIds();
  const { toggle, isPending } = useToggleFavorite({
    labels: { added: t('added'), removed: t('removed'), error: t('error'), authRequired: t('authRequired') },
  });
  return (quote) =>
    enabled
      ? {
          showFavoriteButton: true,
          isFavorite: ids.has(quote.id) || Boolean(quote.isFavorite),
          onToggleFavorite: toggle,
          isFavoritePending: isPending,
        }
      : {};
}
