/**
 * Motivations for one good deed, after the website's good-deed page (good-deeds/[slug]): the deed's name and
 * description, its reward as a next-step note, the type filter, the quote cards and «تذكير آخر».
 * Core screen: good deed → motivations (mobile-plan §3).
 */

import React, { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGoodDeedQuotesInfinite } from '@/lib/api/good-deeds';
import type { GoodDeedQuotesMeta } from '@/lib/types/api';
import { TopicQuoteList, useLastDefined, useTopicQuoteParams } from '@/components/TopicQuoteList';
import { useTheme } from '@/theme';
import { NextStep, Text } from '@/ui';

export default function MotivationsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { english } = useTheme();
  const { filter, setFilter, shuffle, params } = useTopicQuoteParams();
  const query = useGoodDeedQuotesInfinite(slug ?? '', params);

  const firstPage = query.data?.pages[0];
  const deed = useLastDefined(firstPage?.data.goodDeed);
  // The API counts within the active filter, so the tab counts are the ones read under «الكل».
  const counts = useLastDefined(filter === 'ALL' ? (firstPage?.meta as GoodDeedQuotesMeta | undefined)?.countsByType : undefined);
  const quotes = useMemo(() => query.data?.pages.flatMap((p) => p.data.items.map((item) => item.quote)) ?? [], [query.data]);
  // As on the website: English shows the English description and reward or nothing, never Arabic prose.
  const reward = deed ? (english ? deed.reward : deed.rewardAr) : null;

  return (
    <TopicQuoteList
      query={query}
      quotes={quotes}
      counts={counts}
      filter={filter}
      onFilterChange={setFilter}
      onShuffle={shuffle}
      eyebrow={t('motivations.eyebrow')}
      title={deed ? (english ? deed.name || deed.nameAr : deed.nameAr) : null}
      lead={deed ? (english ? deed.description : deed.descriptionAr) : null}
      sectionTitle={t('motivations.virtueHeading')}
      emptyMessage={t('motivations.empty')}
      intro={
        reward ? (
          <NextStep title={t('motivations.reward')}>
            <Text variant={english ? 'body' : 'reading'}>{reward}</Text>
          </NextStep>
        ) : null
      }
    />
  );
}
