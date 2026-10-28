/**
 * Evidence texts for a habit, an occasion or a program stage. The texts come only from the API
 * (`/v1/practice/evidence`, published quotes); ids the API does not return are skipped silently.
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QuoteCard } from '@/components/QuoteCard';
import type { QuoteDto } from '@/lib/types/api';
import { Colors } from '@/lib/tokens';
import { Body, SectionTitle } from './ui';

export function EvidenceList({
  ids,
  byId,
  loading,
  error,
  title,
}: {
  ids: readonly string[] | undefined;
  byId: Map<string, QuoteDto> | undefined;
  loading?: boolean;
  error?: boolean;
  title?: string;
}) {
  const { t } = useTranslation();
  if (!ids || ids.length === 0) return null;
  const quotes = ids.map((id) => byId?.get(id)).filter((q): q is QuoteDto => Boolean(q));
  if (loading) return <ActivityIndicator color={Colors.primary} />;
  if (error && quotes.length === 0) return <Body small muted>{t('practice.evidenceError')}</Body>;
  if (quotes.length === 0) return null;
  return (
    <View style={{ gap: 4, marginHorizontal: -16 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionTitle>{title ?? t('practice.evidence')}</SectionTitle>
      </View>
      {quotes.map((q) => (
        <QuoteCard key={q.id} quote={q} />
      ))}
    </View>
  );
}
