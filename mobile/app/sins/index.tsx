/**
 * Sin picker: the website's topic catalogue as a full-screen list, categorized (owner, 2026-11-01): search, the
 * «الكبائر» chip and the topic domains as chips, and the list in domain groups (`TopicCatalog`). Full screen, not a
 * bottom sheet: the keyboard would take half a sheet, and this must work one-handed, fast, under stress
 * (mobile-plan §3). The native header owns Back; the page shows its own title.
 */

import React, { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DoorOpen } from 'lucide-react-native';
import { useSins } from '@/lib/api/sins';
import type { CatalogOptions } from '@/lib/topic-catalog';
import { useTheme } from '@/theme';
import { TopicCatalog } from '@/components/TopicCatalog';

const OPTIONS: CatalogOptions = { kabira: true };
const openSin = (slug: string) => router.push(`/sins/${slug}`);

export default function SinPickerScreen() {
  const { t } = useTranslation();
  const { english } = useTheme();
  const { data, isLoading, isError, isRefetching, refetch } = useSins({ sort: 'quoteCount', limit: 100 });
  // A paired sin is found by its page's shared title too («الصلاة» finds «ترك الصلاة»).
  const entries = useMemo(
    () => data?.map((sin) => ({ ...sin, aliases: sin.pair ? [english ? sin.pair.titleEn : sin.pair.titleAr] : [] })),
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
      eyebrow={t('sinPicker.eyebrow')}
      title={t('home.sinEntryLabel')}
      searchPlaceholder={t('sinPicker.searchPlaceholder')}
      emptyMessage={t('sinPicker.empty')}
      icon={DoorOpen}
      options={OPTIONS}
      quickLabel={t('catalog.kabira')}
      onOpen={openSin}
    />
  );
}
