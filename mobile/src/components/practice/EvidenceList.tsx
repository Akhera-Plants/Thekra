/**
 * Evidence texts for a habit, an occasion or a program stage, after the website's EvidenceQuotes: a section
 * heading, then the quote cards. The texts come only from the API (`/v1/practice/evidence`, published quotes);
 * ids the API does not return are skipped silently. While loading it shows a card-shaped placeholder.
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QuoteCard } from '@/components/QuoteCard';
import type { QuoteDto } from '@/lib/types/api';
import { space, useStyles } from '@/theme';
import { QuoteCardSkeleton, Text } from '@/ui';

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
      <Text variant="small" tone="muted">
        {t('practice.evidenceError')}
      </Text>
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
