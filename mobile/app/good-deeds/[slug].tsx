/**
 * Motivations for one good deed, after the website's good-deed page (good-deeds/[slug]): the deed's name (a paired
 * page's shared title), description and the contemporary note, then the type tabs right under them (owner,
 * 2026-11-01), then inside the tab: ONE action («اجعلها عادتي», when a catalog habit maps to the deed), its reward as a
 * next-step note (unpaired only, under «الكل»), the reading sections (its merit and reward,
 * the opposite sin's warning, a contemporary topic's derived groups), «من شعب الإيمان», and the opposite sin on an
 * unpaired page.
 * Core screen: good deed → motivations (mobile-plan §3).
 */

import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useGoodDeed, useGoodDeedQuotesInfinite } from '@/lib/api/good-deeds';
import { buildTopicSections } from '@/lib/topics';
import type { GoodDeedQuotesMeta, TopicGroup } from '@/lib/types/api';
import { TopicQuoteList, useLastDefined, useTopicQuoteParams } from '@/components/TopicQuoteList';
import { DeedHabitAction, TopicBranchLinks } from '@/components/TopicTemplate';
import { useTheme } from '@/theme';
import { ListRow, NextStep, Section, Text } from '@/ui';

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
      meta={
        isContemporary ? (
          <Text variant="small" tone="muted">
            {t('motivations.contemporaryNote')}
          </Text>
        ) : null
      }
      emptyMessage={t('motivations.empty')}
      intro={
        deed ? (
          <>
            {/* Under the tabs (owner, 2026-11-01): one action → the reward → texts → شعب الإيمان → the opposite. */}
            <DeedHabitAction deed={deed.slug} />
            {reward && filter === 'ALL' ? (
              <NextStep title={t('motivations.reward')}>
                <Text variant={english ? 'body' : 'reading'}>{reward}</Text>
              </NextStep>
            ) : null}
          </>
        ) : null
      }
      footer={
        <>
          <TopicBranchLinks branches={detail.data?.branches} />
          {!pair && detail.data?.oppositeSin ? (
            <Section title={t('topic.oppositeTitle')}>
              <View>
                <ListRow
                  icon={Feather}
                  title={english ? detail.data.oppositeSin.name || detail.data.oppositeSin.nameAr : detail.data.oppositeSin.nameAr}
                  onPress={() => router.push(`/sins/${detail.data?.oppositeSin?.slug ?? ''}`)}
                />
              </View>
            </Section>
          ) : null}
        </>
      }
    />
  );
}
