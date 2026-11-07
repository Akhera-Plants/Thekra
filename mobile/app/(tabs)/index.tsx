/**
 * Home (owner round 5, F-02 a; practice-core `home.ts`): a visitor sees the public sections in their fixed order; a
 * signed-in member sees `visibleHomeSections` (their order and choice, synced with the account) and «خصّص الرئيسية»
 * at the end, which opens the edit sheet (a switch and «أعلى» / «أسفل» per section). Sections: «ورد اليوم» (members:
 * progress and a circle per habit not logged yet, logging right here), «نص اليوم», «شعبة الأسبوع», «مناسبة قريبة»,
 * «أبواب الخير», «في لحظات مثل هذه», «تذكرة مختارة», «المصادر» (src/components/home/HomeSections.tsx). The flower
 * divider sits between visible sections only. «مواسم الخير» has no entry any more (F-17). The device-local «شعبة
 * الأسبوع» switch moves once into the synced sections (src/lib/home/home-edit.ts).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LayoutList } from 'lucide-react-native';
import { setHomeSections, visibleHomeSections } from '@thekra/practice-core';
import { weekBranchMigration } from '@/lib/home/home-edit';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useHubDays } from '@/lib/practice/use-habits-hub';
import { useAuthStore } from '@/lib/stores/auth-store';
import { AppHeader } from '@/components/nav/AppHeader';
import { HomeEditSheet, HomeSection, useSectionShows } from '@/components/home/HomeSections';
import { space, useStyles, type Theme } from '@/theme';
import { Button, Screen, SectionDivider } from '@/ui';

const makeStyles = (_t: Theme) => ({
  customize: { alignItems: 'center' as const, paddingTop: space.sm },
});

export default function HomeScreen() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const member = useAuthStore((s) => s.user !== null);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const stored = usePracticeStore((s) => s.store.settings.homeSections);
  const weekBranchPref = usePracticeStore((s) => s.prefs.weekBranch);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const { today } = useHubDays();
  const shows = useSectionShows(today);
  const [editing, setEditing] = useState(false);
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
      {member ? (
        <>
          <SectionDivider />
          <View style={styles.customize}>
            <Button label={t('homeSections.edit.title')} icon={LayoutList} variant="ghost" onPress={() => setEditing(true)} />
          </View>
          <HomeEditSheet visible={editing} onClose={() => setEditing(false)} />
        </>
      ) : null}
    </Screen>
  );
}
