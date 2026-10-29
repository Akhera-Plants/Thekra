/**
 * Evidence texts for a habit, an occasion or a program stage, after the website's EvidenceQuotes: a section
 * heading, then the quote cards. The texts come only from the API (`/v1/practice/evidence`, published quotes);
 * ids the API does not return are skipped silently. While loading it shows a card-shaped placeholder; on an error, the
 * kit's error state with «حاول مجددًا» (refetches the evidence lists on screen).
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { QuoteCard } from '@/components/QuoteCard';
import type { QuoteDto } from '@/lib/types/api';
import { space, useStyles } from '@/theme';
import { ErrorState, QuoteCardSkeleton, Text } from '@/ui';

interface EvidenceListProps {
  ids: readonly string[] | undefined;
  byId: Map<string, QuoteDto> | undefined;
  loading?: boolean;
  error?: boolean;
  title?: string;
}

const makeStyles = () => ({
  list: { gap: space.md },
});

export function EvidenceList({ ids, byId, loading, error, title }: EvidenceListProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const queryClient = useQueryClient();
  const handleRetry = useCallback(
    () => void queryClient.refetchQueries({ queryKey: queryKeys.practice.evidenceAll, type: 'active' }),
    [queryClient],
  );
  if (!ids || ids.length === 0) return null;
  const quotes = ids.map((id) => byId?.get(id)).filter((q): q is QuoteDto => Boolean(q));
  const heading = (
    <Text variant="heading" accessibilityRole="header">
      {title ?? t('practice.evidence')}
    </Text>
  );
  if (loading) {
    return (
      <View style={styles.list}>
        {heading}
        <QuoteCardSkeleton />
      </View>
    );
  }
  if (error && quotes.length === 0) {
    return (
      <View style={styles.list}>
        {heading}
        <ErrorState message={t('practice.evidenceError')} onRetry={handleRetry} />
      </View>
    );
  }
  if (quotes.length === 0) return null;
  return (
    <View style={styles.list}>
      {heading}
      {quotes.map((q) => (
        <QuoteCard key={q.id} quote={q} />
      ))}
    </View>
  );
}
