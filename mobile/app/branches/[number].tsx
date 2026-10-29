/**
 * One branch of faith, after the website's branch page (branches/[number]/page.tsx): «الشعبة N» over the branch's
 * title and summary (each language its own or none: no Arabic prose in English), the book's words on it
 * («من الكتاب», BRANCH_SHARH), the type filter and the texts (TopicQuoteList), then «السابقة · الكل · التالية».
 * Prev and next replace this page, so Back still leads to the list; «الكل» returns to the list (or opens it).
 */

import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LayoutList, SearchX } from 'lucide-react-native';
import { useBranch, useBranchQuotesInfinite } from '@/lib/api/branches';
import { buildTopicSections } from '@/lib/topics';
import type { BranchQuotesMeta, ImanBranchDetailDto, ImanBranchNeighbourDto } from '@/lib/types/api';
import { TopicQuoteList, useLastDefined, useTopicQuoteParams } from '@/components/TopicQuoteList';
import { space, useStyles, useTheme } from '@/theme';
import { BackChevron, Card, EmptyState, ForwardChevron, Icon, Row, Screen, Section, Text } from '@/ui';

type Translate = ReturnType<typeof useTranslation>['t'];

const makeStyles = () => ({
  nav: { flexDirection: 'row' as const, alignItems: 'stretch' as const, gap: space.sm },
  side: { flex: 1 },
  sideCard: { flex: 1, gap: space.xs },
  navLabel: { gap: space.xs },
  allCard: { alignItems: 'center' as const, justifyContent: 'center' as const, gap: space.xs, paddingHorizontal: space.md },
  explanations: { gap: space.lg },
});

/** A branch's name in the UI language: English shows its English title or «Branch N», never the Arabic one. */
function branchName(branch: ImanBranchNeighbourDto, english: boolean, t: Translate): string {
  return english ? branch.title || t('branches.branchFallback', { number: branch.number }) : branch.titleAr;
}

function goToBranch(number: number) {
  router.replace(`/branches/${number}`);
}

function NeighbourCard({ branch, direction }: { branch: ImanBranchNeighbourDto | null; direction: 'prev' | 'next' }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const { english } = useTheme();
  const handlePress = useCallback(() => {
    if (branch) goToBranch(branch.number);
  }, [branch]);
  if (!branch) return <View style={styles.side} />;
  const name = branchName(branch, english, t);
  return (
    <Card onPress={handlePress} style={styles.sideCard} accessibilityLabel={t(`branches.${direction}Label`, { title: name })}>
      <Row style={styles.navLabel}>
        {direction === 'prev' ? <BackChevron size={16} tone="link" /> : null}
        <Text variant="caption" tone="link">
          {t(`branches.${direction}`)}
        </Text>
        {direction === 'next' ? <ForwardChevron size={16} tone="link" /> : null}
      </Row>
      <Text variant="small" weight="medium" numberOfLines={2}>
        {name}
      </Text>
    </Card>
  );
}

const handleAll = () => router.dismissTo('/branches');

/** «السابقة · الكل · التالية» (the site's `reader-end` nav). */
function BranchNav({ detail }: { detail: ImanBranchDetailDto }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.nav} accessibilityRole="toolbar">
      <NeighbourCard branch={detail.prev} direction="prev" />
      <Card onPress={handleAll} style={styles.allCard} accessibilityLabel={t('branches.pageTitle')}>
        <Icon icon={LayoutList} size={20} tone="link" strokeWidth={1.3} />
        <Text variant="caption" tone="link">
          {t('branches.all')}
        </Text>
      </Card>
      <NeighbourCard branch={detail.next} direction="next" />
    </View>
  );
}

/** «من الكتاب»: the book's own words on the branch, as the site shows them. */
function BranchExplanations({ items }: { items: ImanBranchDetailDto['explanations'] }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <Section title={t('branches.explanations')}>
      <View style={styles.explanations}>
        {items.map((item) => (
          <Text key={item.id} variant="reading">
            {item.text}
          </Text>
        ))}
      </View>
    </Section>
  );
}

export default function BranchScreen() {
  const params = useLocalSearchParams<{ number: string }>();
  const parsed = Number(params.number);
  const number = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  const { t } = useTranslation();
  const { english } = useTheme();
  const { filter, setFilter, params: quoteParams } = useTopicQuoteParams();
  const query = useBranchQuotesInfinite(number, quoteParams);
  // The detail carries what the quotes page does not: the English summary, the book's words, the neighbours.
  const detail = useBranch(number);

  const firstPage = query.data?.pages[0];
  const branch = useLastDefined(firstPage?.data.branch);
  // The API counts within the active filter, so the tab counts are the ones read under «الكل».
  const counts = useLastDefined(filter === 'ALL' ? (firstPage?.meta as BranchQuotesMeta | undefined)?.countsByType : undefined);
  const sections = useMemo(
    () =>
      buildTopicSections(query.data?.pages.map((p) => p.data) ?? [], {
        sectioned: filter === 'ALL',
        ownTitle: t('branches.quotes'),
        companionTitle: t('branches.quotes'),
        groupTitle: () => t('branches.quotes'),
      }),
    [query.data, filter, t],
  );

  if (!number) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} message={t('common.notFound')} actionLabel={t('branches.pageTitle')} onAction={handleAll} />
      </Screen>
    );
  }

  const summary = english ? detail.data?.summary : (detail.data?.summaryAr ?? branch?.summaryAr);

  return (
    <TopicQuoteList
      query={query}
      sections={sections}
      counts={counts}
      filter={filter}
      onFilterChange={setFilter}
      eyebrow={t('branches.branchFallback', { number })}
      title={branch ? branchName(branch, english, t) : null}
      lead={summary}
      emptyMessage={t('branches.noQuotes')}
      intro={detail.data ? <BranchExplanations items={detail.data.explanations} /> : null}
      footer={detail.data ? <BranchNav detail={detail.data} /> : null}
    />
  );
}
