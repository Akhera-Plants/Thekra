/**
 * Home (owner round 5, F-02 a; round 6 §8, C-04 / C-06 / C-09 / C-11 / C-01q): a visitor sees the doors first, then the
 * public sections; a signed-in member who never customised the page sees the short «ورد اليوم» (progress and a circle per
 * habit not logged yet, logging right here) and then the doors right away (practice-core `visibleHomeSections`), then the rest. A member's
 * own order and choice (synced with the account) is kept. «خصّص الرئيسية» lives only in the settings («اللغة والمظهر»):
 * no button on the page. «نص اليوم» is gone. Sections: «ورد اليوم», «شعبة الأسبوع», «مناسبة قريبة», «أبواب الخير»,
 * «في لحظات مثل هذه» (from the API), «تذكرة مختارة», «المصادر» (src/components/home/HomeSections.tsx). The flower divider
 * sits between visible sections only. The device-local «شعبة الأسبوع» switch moves once into the synced sections
 * (src/lib/home/home-edit.ts).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setHomeSections, visibleHomeSections } from '@thekra/practice-core';
import { weekBranchMigration } from '@/lib/home/home-edit';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useHubDays } from '@/lib/practice/use-habits-hub';
import { useAuthStore } from '@/lib/stores/auth-store';
import { AppHeader } from '@/components/nav/AppHeader';
import { HomeSection, useSectionShows } from '@/components/home/HomeSections';
import { Screen, SectionDivider } from '@/ui';

export default function HomeScreen() {
  const member = useAuthStore((s) => s.user !== null);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const stored = usePracticeStore((s) => s.store.settings.homeSections);
  const weekBranchPref = usePracticeStore((s) => s.prefs.weekBranch);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const { today } = useHubDays();
  const shows = useSectionShows(today);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // One-time: the old device switch «شعبة الأسبوع» becomes the synced section (then the switch is cleared).
  useEffect(() => {
    if (!hydrated) return;
    const moved = weekBranchMigration(stored, weekBranchPref);
    if (moved) setStore((s) => setHomeSections(s, moved));
    if (weekBranchPref) setPrefs((p) => ({ ...p, weekBranch: false }));
  }, [hydrated, stored, weekBranchPref, setStore, setPrefs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void qc.refetchQueries({ type: 'active' }).finally(() => setRefreshing(false));
  }, [qc]);

  const sections = visibleHomeSections(stored, member).filter(shows);
  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <AppHeader />
      {sections.map((name, i) => (
        <HomeSection key={name} name={name} today={today} before={i > 0 ? <SectionDivider /> : null} />
      ))}
    </Screen>
  );
}
