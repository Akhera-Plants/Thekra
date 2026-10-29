/**
 * «تذكرة مختارة», after the website's FeaturedReminder: the API's text of the day (`GET /v1/quotes/today`, the same for
 * everyone on a UTC day) in the app's quote card, with its share and save actions and «اقرأ النص كاملًا».
 * Hidden when the API has no text for today; a calm retry when it cannot answer.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useToggleFavorite } from '@/lib/api/favorites';
import type { QuoteDto } from '@/lib/types/api';
import { QuoteCard } from '@/components/QuoteCard';
import { ErrorState, QuoteCardSkeleton, Section } from '@/ui';

interface IFeaturedReminderProps {
  /** Undefined until read; null when there is no text today. */
  quote: QuoteDto | null | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function ReminderCard({ quote }: { quote: QuoteDto }) {
  const { isFavorite, toggle } = useToggleFavorite(quote.id);
  return <QuoteCard quote={quote} isFavorite={isFavorite} onToggleFavorite={toggle} />;
}

export function FeaturedReminder({ quote, isLoading, isError, onRetry }: IFeaturedReminderProps) {
  const { t } = useTranslation();
  const body = quote ? (
    <ReminderCard quote={quote} />
  ) : isLoading ? (
    <QuoteCardSkeleton />
  ) : isError ? (
    <ErrorState onRetry={onRetry} />
  ) : null;
  if (!body) return null;
  return <Section title={t('home.todayHeading')}>{body}</Section>;
}
