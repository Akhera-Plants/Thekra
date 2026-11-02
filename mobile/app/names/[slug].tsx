/**
 * One Name of Allah on the topic template (redesign §4.7), after the website's /names/[slug]: the verse
 * that contains the name (from the API by id; never typed text), one line of meaning with «قيد المراجعة», «التعبّد
 * بهذا الاسم» = links to related topics, then the other verses with the word, and «السابق · التالي».
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react-native';
import { useNameOfAllah } from '@/lib/api/names';
import type { NameOfAllahDto } from '@/lib/types/api';
import { QuoteCard } from '@/components/QuoteCard';
import { NameVerse, NameWorshipLinks } from '@/components/TopicTemplate';
import { space, useStyles, useTheme } from '@/theme';
import { BackChevron, Card, EmptyState, ErrorState, ForwardChevron, Loading, PageHeader, Row, Screen, Section, Text } from '@/ui';

const makeStyles = () => ({
  stack: { gap: space['2xl'] },
  verses: { gap: space.md },
  nav: { flexDirection: 'row' as const, alignItems: 'stretch' as const, gap: space.sm },
  side: { flex: 1 },
  sideCard: { flex: 1, gap: space.xs },
  navLabel: { gap: space.xs },
  name: { fontSize: 40, lineHeight: 72 },
});

function NeighbourCard({ name, direction }: { name: NameOfAllahDto | null; direction: 'prev' | 'next' }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const handlePress = useCallback(() => {
    if (name) router.replace(`/names/${name.slug}`);
  }, [name]);
  if (!name) return <View style={styles.side} />;
  return (
    <Card onPress={handlePress} style={styles.sideCard} accessibilityLabel={`${t(`names.${direction}`)}: ${name.nameAr}`}>
      <Row style={styles.navLabel}>
        {direction === 'prev' ? <BackChevron size={16} tone="link" /> : null}
        <Text variant="caption" tone="link">
          {t(`names.${direction}`)}
        </Text>
        {direction === 'next' ? <ForwardChevron size={16} tone="link" /> : null}
      </Row>
      <Text variant="small" weight="medium">
        {name.nameAr}
      </Text>
    </Card>
  );
}

export default function NameScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const { t } = useTranslation();
  const { english } = useTheme();
  const styles = useStyles(makeStyles);
  const { data: detail, isLoading, isError, error, refetch } = useNameOfAllah(slug);

  if (isLoading) {
    return (
      <Screen edges={['bottom']}>
        <Loading />
      </Screen>
    );
  }
  if (!detail) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    return (
      <Screen edges={['bottom']}>
        {isError && !notFound ? (
          <ErrorState message={t('errors.network')} onRetry={() => void refetch()} />
        ) : (
          <EmptyState icon={SearchX} message={t('names.empty')} />
        )}
      </Screen>
    );
  }

  // English meanings are ours, not from a source (PROJECT_GUIDE content rule 2): show the Arabic until one exists.
  const meaning = detail.meaningAr;
  const pending = detail.review === 'pending-sheikh';

  return (
    <Screen edges={['bottom']}>
      <View style={styles.stack}>
        <PageHeader eyebrow={t('names.number', { number: String(detail.number) })} title={detail.nameAr} />

        {detail.verse ? (
          <NameVerse quote={detail.verse} lead={t('names.verseLead')} />
        ) : (
          <Text variant="small" tone="muted">
            {t('names.verseMissing')}
          </Text>
        )}

        <Section title={t('names.meaningTitle')}>
          <Text variant="body">
            {meaning}
            {pending ? (
              <Text variant="caption" tone="muted">
                {`  (${t('names.pendingReview')})`}
              </Text>
            ) : null}
          </Text>
        </Section>

        <NameWorshipLinks links={detail.links} />

        {detail.otherVerses.length > 0 ? (
          <Section title={t('names.otherVersesTitle')}>
            <View style={styles.verses}>
              {detail.otherVerses.map((quote) => (
                <QuoteCard key={quote.id} quote={quote} />
              ))}
            </View>
          </Section>
        ) : null}

        <View style={styles.nav} accessibilityRole="toolbar">
          <NeighbourCard name={detail.prev} direction="prev" />
          <NeighbourCard name={detail.next} direction="next" />
        </View>
      </View>
    </Screen>
  );
}
