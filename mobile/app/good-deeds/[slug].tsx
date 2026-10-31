/**
 * Motivations for one good deed, after the website's good-deed page (good-deeds/[slug]): the deed's name (a paired
 * page's shared title) and description, its reward as a next-step note (unpaired only), «اجعلها عادة» (the catalog
 * habits of this deed), the contemporary note, the type filter, then the reading sections: its merit and reward,
 * the opposite sin's warning, a contemporary topic's derived groups.
 * Core screen: good deed → motivations (mobile-plan §3).
 */

import React, { useCallback, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGoodDeed, useGoodDeedQuotesInfinite } from '@/lib/api/good-deeds';
import { buildTopicSections } from '@/lib/topics';
import type { GoodDeedQuotesMeta, TopicGroup } from '@/lib/types/api';
import { TopicQuoteList, useLastDefined, useTopicQuoteParams } from '@/components/TopicQuoteList';
import { DeedHabits } from '@/components/practice/TopicPracticeLinks';
import { useTheme } from '@/theme';
import { NextStep, Text } from '@/ui';

export default function MotivationsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { english } = useTheme();
  const { filter, setFilter, params } = useTopicQuoteParams();
  const query = useGoodDeedQuotesInfinite(slug ?? '', params);
  // The detail carries the pair and the contemporary flag, which the quotes page does not.
  const detail = useGoodDeed(slug ?? '');

  const firstPage = query.data?.pages[0];
  const deed = useLastDefined(firstPage?.data.goodDeed);
  // The API counts within the active filter, so the tab counts are the ones read under «الكل».
  const counts = useLastDefined(filter === 'ALL' ? (firstPage?.meta as GoodDeedQuotesMeta | undefined)?.countsByType : undefined);
  const pair = detail.data?.pair ?? null;
  const groupTitle = useCallback((group: TopicGroup) => (english ? group.name || group.nameAr : group.nameAr), [english]);
  const sections = useMemo(
    () =>
      buildTopicSections(query.data?.pages.map((p) => p.data) ?? [], {
        sectioned: filter === 'ALL',
        ownTitle: pair ? t('motivations.pairVirtueHeading') : t('motivations.virtueHeading'),
        companionTitle: pair ? t('motivations.pairNeglectHeading') : t('motivations.neglectHeading'),
        groupTitle,
      }),
    [query.data, filter, pair, t, groupTitle],
  );
  // As on the website: English shows the English description and reward or nothing, never Arabic prose; a paired
  // page is titled by the pair and carries no separate reward note.
  const reward = deed && !pair ? (english ? deed.reward : deed.rewardAr) : null;
  const name = deed ? (english ? deed.name || deed.nameAr : deed.nameAr) : null;
  const title = pair ? (english ? pair.titleEn : pair.titleAr) : name;
  const isContemporary = detail.data?.isContemporary ?? deed?.isContemporary ?? false;

  return (
    <TopicQuoteList
      query={query}
      sections={sections}
      counts={counts}
      filter={filter}
      onFilterChange={setFilter}
      eyebrow={t('motivations.eyebrow')}
      title={deed ? title : null}
      lead={deed ? (english ? deed.description : deed.descriptionAr) : null}
      emptyMessage={t('motivations.empty')}
      intro={
        <>
          {reward ? (
            <NextStep title={t('motivations.reward')}>
              <Text variant={english ? 'body' : 'reading'}>{reward}</Text>
            </NextStep>
          ) : null}
          {deed ? <DeedHabits deed={deed.slug} /> : null}
          {isContemporary ? (
            <Text variant="lead" tone="muted">
              {t('motivations.contemporaryNote')}
            </Text>
          ) : null}
        </>
      }
    />
  );
}
