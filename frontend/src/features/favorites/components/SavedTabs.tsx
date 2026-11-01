'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { MyRemindersView } from '@/features/practice/components/screen/MyRemindersView';
import { FavoritesList } from './FavoritesList';

export type SavedTab = 'texts' | 'reminders';

/** «المحفوظات» in two parts (owner, 2026-11-01): «النصوص المحفوظة» and «تذكيراتي». `?tab=reminders` opens the second. */
export function SavedTabs({ initial }: { initial: SavedTab }) {
  const t = useTranslations('favorites');
  const [tab, setTab] = useState<SavedTab>(initial);

  function choose(value: string) {
    const next: SavedTab = value === 'reminders' ? 'reminders' : 'texts';
    setTab(next);
    // Keep the address in step, so a reload or a shared link opens the same part (no navigation, no history entry).
    const url = new URL(window.location.href);
    if (next === 'reminders') url.searchParams.set('tab', 'reminders');
    else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url);
  }

  return (
    <SegmentTabs
      aria-label={t('tabsLabel')}
      items={[
        { value: 'texts', label: t('tabs.texts') },
        { value: 'reminders', label: t('tabs.reminders') },
      ]}
      value={tab}
      onValueChange={choose}
      className="gap-8"
    >
      <SegmentTabsContent value="texts">
        <FavoritesList />
      </SegmentTabsContent>
      <SegmentTabsContent value="reminders">
        <MyRemindersView />
      </SegmentTabsContent>
    </SegmentTabs>
  );
}
