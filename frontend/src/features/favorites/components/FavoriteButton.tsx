/**
 * Re-export from the shared quote layer for feature-level convenience.
 * Use when you need FavoriteButton + useToggleFavorite wired together
 * outside a QuoteCard (e.g. quote detail page header).
 */
'use client';

import { useTranslations } from 'next-intl';
import {
  FavoriteButton as PresentationalFavoriteButton,
} from '@/components/shared/quote/FavoriteButton';
import { useToggleFavorite } from '../hooks/useToggleFavorite';

interface WiredFavoriteButtonProps {
  quoteId: string;
  isFavorite: boolean;
  onRequireAuth?: () => void;
  className?: string;
}

/**
 * Self-contained FavoriteButton that wires useToggleFavorite internally.
 * Use this in feature components (quote detail page, etc.).
 * QuoteCard (in components/shared/quote/) uses the presentational version.
 */
export function FavoriteButton({
  quoteId,
  isFavorite,
  onRequireAuth,
  className,
}: WiredFavoriteButtonProps) {
  const t = useTranslations('favorites');
  const { toggle, isPending } = useToggleFavorite({ onRequireAuth });

  return (
    <PresentationalFavoriteButton
      quoteId={quoteId}
      isFavorite={isFavorite}
      isPending={isPending}
      label={t('add')}
      labelRemove={t('remove')}
      onToggle={toggle}
      className={className}
    />
  );
}
