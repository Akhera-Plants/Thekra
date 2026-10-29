/**
 * Evidence texts for a habit, an occasion or a program stage, after the website's EvidenceQuotes: a section
 * heading, then the quote cards. The texts come only from the API (`/v1/practice/evidence`, published quotes);
 * ids the API does not return are skipped silently. While loading it shows a card-shaped placeholder; on an error, the
 * kit's error state with «حاول مجددًا» (refetches the evidence lists on screen).
 * With `limit` only the first texts show, and `moreHref` puts «المزيد» beside the heading (the topic's own page), so a
 * screen does not repeat the texts its topic page already reads.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { QuoteCard } from '@/components/QuoteCard';
import type { QuoteDto } from '@/lib/types/api';
import { space, useStyles } from '@/theme';
import { ErrorState, QuoteCardSkeleton, Text, TextLink } from '@/ui';

interface EvidenceListProps {
  ids: readonly string[] | undefined;
  byId: Map<string, QuoteDto> | undefined;
  loading?: boolean;
  error?: boolean;
  title?: string;
  /** Show only this many texts (default: all). */
  limit?: number;
  /** «المزيد» beside the heading, to the page that reads all the texts. */
  moreHref?: Href;
}

const makeStyles = () => ({
  list: { gap: space.md },
  heading: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: space.md },
  title: { flex: 1 },
});

export function EvidenceList({ ids, byId, loading, error, title, limit, moreHref }: EvidenceListProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const queryClient = useQueryClient();
  const handleRetry = useCallback(
    () => void queryClient.refetchQueries({ queryKey: queryKeys.practice.evidenceAll, type: 'active' }),
    [queryClient],
  );
  const handleMore = useCallback(() => {
    if (moreHref) router.push(moreHref);
  }, [moreHref]);
  if (!ids || ids.length === 0) return null;
  const quotes = ids
    .map((id) => byId?.get(id))
    .filter((q): q is QuoteDto => Boolean(q))
    .slice(0, limit);
  const heading = (
    <View style={styles.heading}>
      <Text variant="heading" accessibilityRole="header" style={styles.title}>
        {title ?? t('practice.evidence')}
      </Text>
      {moreHref ? <TextLink label={t('common.more')} onPress={handleMore} /> : null}
    </View>
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
