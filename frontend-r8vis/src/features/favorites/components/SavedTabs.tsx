'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { SAVED_TAB_ROUTES, type SavedTab } from '@/lib/nav/saved-tabs';
import { localePath } from '@/lib/seo';
import { FavoritesList } from './FavoritesList';
import { MyRemindersPanel } from './MyRemindersPanel';

export type { SavedTab };

/**
 * «المحفوظات» in two tabs (round 6, C-14: the reference's underline tabs and its line «احتفظ بما تحب أن تعود إليه») (owner round 5, F-22 a / W-30; the app's `app/favorites.tsx`): «النصوص» and «تذكيراتي». Each
 * tab has its address (`/favorites`, `/favorites/reminders`); a tap keeps the address in step without a navigation or a
 * history entry, so a reload or a shared link opens the same tab.
 */
export function SavedTabs({ initial }: { initial: SavedTab }) {
  const t = useTranslations('favorites');
  const locale = useLocale();
  const [tab, setTab] = useState<SavedTab>(initial);

  function choose(value: string) {
    const next: SavedTab = value === 'reminders' ? 'reminders' : 'texts';
    setTab(next);
    window.history.replaceState(null, '', localePath(locale, SAVED_TAB_ROUTES[next]));
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
      variant="underline"
      className="gap-8 [&_[data-slot=tabs-trigger]]:min-h-12 [&_[data-slot=tabs-trigger]]:text-[15px]"
    >
      <SegmentTabsContent value="texts">
        <FavoritesList />
      </SegmentTabsContent>
      <SegmentTabsContent value="reminders">
        <MyRemindersPanel />
      </SegmentTabsContent>
    </SegmentTabs>
  );
}
