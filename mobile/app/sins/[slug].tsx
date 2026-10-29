/**
 * Reminders for one sin, after the website's sin page (sins/[slug]): the sin's name and description, the type
 * filter, the quote cards, «تذكير آخر», then the alternative good deeds as topic rows.
 * Core screen: sin → reminders (mobile-plan §3).
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Sprout } from 'lucide-react-native';
import { useSinQuotesInfinite } from '@/lib/api/sins';
import type { SinQuotesMeta } from '@/lib/types/api';
import { TopicQuoteList, useLastDefined, useTopicQuoteParams } from '@/components/TopicQuoteList';
import { useTheme } from '@/theme';
import { ListRow, Section } from '@/ui';

export default function RemindersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const { english } = useTheme();
  const { filter, setFilter, shuffle, params } = useTopicQuoteParams();
  const query = useSinQuotesInfinite(slug ?? '', params);

  const firstPage = query.data?.pages[0];
  const sin = useLastDefined(firstPage?.data.sin);
  // The API counts within the active filter, so the tab counts are the ones read under «الكل».
  const counts = useLastDefined(filter === 'ALL' ? (firstPage?.meta as SinQuotesMeta | undefined)?.countsByType : undefined);
  const quotes = useMemo(() => query.data?.pages.flatMap((p) => p.data.items.map((item) => item.quote)) ?? [], [query.data]);
  const alternatives = firstPage?.data.alternatives ?? [];

  return (
    <TopicQuoteList
      query={query}
      quotes={quotes}
      counts={counts}
      filter={filter}
      onFilterChange={setFilter}
      onShuffle={shuffle}
      eyebrow={t('reminders.eyebrow')}
      title={sin ? (english ? sin.name || sin.nameAr : sin.nameAr) : null}
      lead={sin ? (english ? sin.description : sin.descriptionAr) : null}
      sectionTitle={t('reminders.warningHeading')}
      emptyMessage={t('reminders.empty')}
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
