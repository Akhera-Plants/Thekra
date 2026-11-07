/**
 * «عاداتي» (owner round 5, §1 IA; docs/plan/2026-11-07-owner-round-5.md): ONE place for the practice, with segmented
 * tabs «ورد اليوم · الدورية · محاسبتي · سجلّي» (src/components/practice/habits/*). The tab is the `?tab=` param
 * (`/habits?tab=review`), so a deep link, a notification or another screen can open it, and switching tabs updates it.
 * Logging happens only in «ورد اليوم» (and the home page's «ورد اليوم» entry). Members only: the tab bar asks a guest
 * to sign in first; this covers a link or a notification. The app header (wordmark and «لحظة مجاهدة») is first.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { HABITS_TABS, parseHabitsTab, type HabitsTab } from '@/lib/practice/habits-view';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useHubDays } from '@/lib/practice/use-habits-hub';
import { AppHeader } from '@/components/nav/AppHeader';
import { PeriodicTab } from '@/components/practice/habits/PeriodicTab';
import { RecordTab } from '@/components/practice/habits/RecordTab';
import { ReviewTab } from '@/components/practice/habits/ReviewTab';
import { WirdTab } from '@/components/practice/habits/WirdTab';
import { space, useStyles, type Theme } from '@/theme';
import { Screen, SegmentTabs, Skeleton, type SegmentItem } from '@/ui';

const SKELETON_ROWS = ['r1', 'r2', 'r3'];

/** The tab labels are the nav map's names (`wird`, `periodic`, `review`, `record`; tested). */
const TAB_LABEL_KEYS: Record<HabitsTab, string> = {
  wird: 'habitsTab.tabs.wird',
  periodic: 'habitsTab.tabs.periodic',
  review: 'habitsTab.tabs.review',
  record: 'habitsTab.tabs.record',
};

const makeStyles = (t: Theme) => ({
  skeleton: { gap: space.md },
  skeletonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  skeletonTexts: { flex: 1, gap: space.sm },
});

export default function HabitsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = parseHabitsTab(params.tab);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const signedIn = useRequireSignIn(`/habits?tab=${tab}`);
  const { today } = useHubDays();
  const items: SegmentItem<HabitsTab>[] = HABITS_TABS.map((key) => ({ key, label: t(TAB_LABEL_KEYS[key]) }));
  const handleTab = useCallback((next: HabitsTab) => router.setParams({ tab: next }), []);
  const ready = signedIn && hydrated;
  return (
    <Screen>
      <AppHeader />
      <SegmentTabs items={items} value={tab} onChange={handleTab} />
      {!ready ? (
        <HabitsSkeleton />
      ) : tab === 'wird' ? (
        <WirdTab today={today} />
      ) : tab === 'periodic' ? (
        <PeriodicTab today={today} />
      ) : tab === 'review' ? (
        <ReviewTab today={today} />
      ) : (
        <RecordTab />
      )}
    </Screen>
  );
}

/** The shape of a tab while the device store loads: a title row, then three rows. */
function HabitsSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.skeleton} accessibilityLabel={t('common.loading')}>
      <Skeleton width="45%" height={26} />
      {SKELETON_ROWS.map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <Skeleton width={28} height={28} round />
          <View style={styles.skeletonTexts}>
            <Skeleton width="55%" height={18} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}
