/**
 * Good-deed picker: the website's topic catalogue as a full-screen list, categorized (owner, 2026-11-01): search, the
 * «عادات مقترحة» chip (the deeds a catalog habit maps to: «اجعلها عادتي» on their page) and the topic domains as chips,
 * and the list in domain groups (`TopicCatalog`), mirroring the sin picker. The native header owns Back; the page
 * shows its own title.
 */

import React, { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Sprout } from 'lucide-react-native';
import { useGoodDeeds } from '@/lib/api/good-deeds';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import type { CatalogOptions } from '@/lib/topic-catalog';
import { useTheme } from '@/theme';
import { TopicCatalog } from '@/components/TopicCatalog';

const openDeed = (slug: string) => router.push(`/good-deeds/${slug}`);

export default function GoodDeedPickerScreen() {
  const { t } = useTranslation();
  const { english } = useTheme();
  const { data, isLoading, isError, isRefetching, refetch } = useGoodDeeds({ sort: 'quoteCount', limit: 100 });
  const habits = usePracticeCatalog(useUiLocale()).data?.habits;
  // «عادات مقترحة» only once the practice catalog is here (it is cached for a day).
  const options = useMemo<CatalogOptions>(() => (habits ? { habitDeeds: new Set(habits.map((h) => h.deed)) } : {}), [habits]);
  const entries = useMemo(
    () => data?.map((deed) => ({ ...deed, aliases: deed.pair ? [english ? deed.pair.titleEn : deed.pair.titleAr] : [] })),
    [data, english],
  );
  const handleRefresh = useCallback(() => void refetch(), [refetch]);
  return (
    <TopicCatalog
      entries={entries}
      isLoading={isLoading}
      isError={isError}
      isRefetching={isRefetching}
      onRefresh={handleRefresh}
      eyebrow={t('goodDeedPicker.eyebrow')}
      title={t('goodDeedPicker.title')}
      lead={t('goodDeedPicker.lead')}
      searchPlaceholder={t('goodDeedPicker.searchPlaceholder')}
      emptyMessage={t('goodDeedPicker.empty')}
      icon={Sprout}
      options={options}
      quickLabel={t('catalog.habits')}
      onOpen={openDeed}
    />
  );
}
