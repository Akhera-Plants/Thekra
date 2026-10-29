/**
 * Reminders for one sin, after the website's sin page (sins/[slug]): the sin's name and description, «كبيرة» with
 * its reference, the contemporary note, «ابدأ برنامج الترك» when the catalog has a program for it, the type filter,
 * then the reading sections: what warns against it, the paired deed's virtue (or the reward of leaving it for
 * Allah), a contemporary topic's derived groups; the alternative good deeds last, only on an unpaired sin.
 * Core screen: sin → reminders (mobile-plan §3).
 */

import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Sprout } from 'lucide-react-native';
import { useSin, useSinQuotesInfinite } from '@/lib/api/sins';
import { buildTopicSections } from '@/lib/topics';
import type { SinQuotesMeta, TopicGroup } from '@/lib/types/api';
import { SinRank } from '@/lib/types/enums';
import { TopicQuoteList, useLastDefined, useTopicQuoteParams } from '@/components/TopicQuoteList';
import { SinProgramLink } from '@/components/practice/TopicPracticeLinks';
import { useTheme } from '@/theme';
import { ListRow, Section, Text } from '@/ui';

export default function RemindersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { english } = useTheme();
  const { filter, setFilter, params } = useTopicQuoteParams();
  const query = useSinQuotesInfinite(slug ?? '', params);
  // The detail carries what the quotes page does not: the pair, the rank reference, the contemporary flag.
  const detail = useSin(slug ?? '');

  const firstPage = query.data?.pages[0];
  const sin = useLastDefined(firstPage?.data.sin);
  // The API counts within the active filter, so the tab counts are the ones read under «الكل».
  const counts = useLastDefined(filter === 'ALL' ? (firstPage?.meta as SinQuotesMeta | undefined)?.countsByType : undefined);
  const paired = Boolean(detail.data?.pair);
  const groupTitle = useCallback((group: TopicGroup) => (english ? group.name || group.nameAr : group.nameAr), [english]);
  const sections = useMemo(
    () =>
      buildTopicSections(query.data?.pages.map((p) => p.data) ?? [], {
        sectioned: filter === 'ALL',
        ownTitle: paired ? t('reminders.pairWarningHeading') : t('reminders.warningHeading'),
        companionTitle: paired ? t('reminders.pairRewardHeading') : t('reminders.rewardHeading'),
        groupTitle,
      }),
    [query.data, filter, paired, t, groupTitle],
  );
  // A paired page is one topic with its virtue: «بدلًا من ذلك» is for an unpaired sin only (as on the website).
  const alternatives = detail.isLoading || paired ? [] : (firstPage?.data.alternatives ?? []);
  const isKabira = detail.data?.rank === SinRank.KABIRA && Boolean(detail.data.rankReference);
  const isContemporary = detail.data?.isContemporary ?? sin?.isContemporary ?? false;

  return (
    <TopicQuoteList
      query={query}
      sections={sections}
      counts={counts}
      filter={filter}
      onFilterChange={setFilter}
      eyebrow={t('reminders.eyebrow')}
      title={sin ? (english ? sin.name || sin.nameAr : sin.nameAr) : null}
      lead={sin ? (english ? sin.description : sin.descriptionAr) : null}
      emptyMessage={t('reminders.empty')}
      intro={
        sin ? (
          <>
            {isKabira && detail.data ? (
              <Text variant="lead" tone="muted">
                {/* The reference is stored in Arabic: the English view shows the rank alone. */}
                {english ? t('reminders.kabira') : `${t('reminders.kabira')} · ${detail.data.rankReference}`}
              </Text>
            ) : null}
            {isContemporary ? (
              <Text variant="lead" tone="muted">
                {t('reminders.contemporaryNote')}
              </Text>
            ) : null}
            <SinProgramLink sin={sin.slug} />
          </>
        ) : null
      }
      footer={
        alternatives.length > 0 ? (
          <Section title={t('reminders.alternatives')}>
            <View>
              {alternatives.map((alt) => (
                <ListRow
                  key={alt.id}
                  icon={Sprout}
                  title={english ? alt.name || alt.nameAr : alt.nameAr}
                  onPress={() => router.push(`/good-deeds/${alt.slug}`)}
                />
              ))}
            </View>
          </Section>
        ) : null
      }
    />
  );
}
