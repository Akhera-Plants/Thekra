/**
 * «ورد اليوم» (the centre tab), top to bottom, each part under its own header and divided by a hairline rule (owner,
 * 2026-11-03: separators, not one long column of text):
 * 0. on a Friday, last week's «رسالة إلى نفسي» first; under the header one rotating text (المراقبة) and the cards of
 *    «نية اليوم», a due «التزام شخصي» and «المحاسبة» (components/practice/hub/HeartCards.tsx);
 * 1. the title, one date line (Gregorian; Hijri too with «إظهار التاريخ الهجري»), the streak chip and «أضف»;
 * 2. «اليوم», the page's main list: today's sunnah occasion as one compact line, then one row per task from
 *    practice-core `dayAgenda` (habits asked for today, relatives due as periodic acts, the generic private check-in),
 *    done rows at the bottom; habits not asked for today behind ONE collapsed row. Under it, quiet and compact: a tick's
 *    «تقبّل الله منك», «تمّ وردك اليوم» (item 4), the stories at their moments as one-line notes that open a sheet
 *    («عملك المعتاد يُكتب لك» only the day after an excused day, with a commitment above 60%: item 8), and «حال يومي»
 *    (one control for «يومي ثقيل» and «عذر», DayState);
 * 3. «أعمال دورية» (owner round 3, item 6): the next three periodic acts with their dates, «الكل» on the title's line;
 * 4. «شعبة الأسبوع» as one compact row, only for a member who opted in (item 7).
 * The month calendar and the habit management live in «عاداتي»; «تخفَّف», «رفقة» and the saved texts in the side menu.
 * The app header (menu, wordmark, tagline) is first. No background art.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { usePracticeCatalog } from '@/lib/api/practice';
import { dateLine } from '@/lib/practice/calendar-grid';
import { usePracticeStore } from '@/lib/practice/practice-store';
import {
  useAgendaActions,
  useAgendaRows,
  useDateNames,
  useDayAgenda,
  useHubDays,
  useOffDayHabits,
  usePeriodicRows,
  useStreak,
} from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { upcomingPeriodic } from '@/lib/practice/wird';
import { minimumMet } from '@thekra/practice-core';
import { showUsualDeed } from '@/lib/practice/commitment';
import { habitFor } from '@/lib/practice/reminders';
import { AppHeader } from '@/components/nav/AppHeader';
import { AddSheet } from '@/components/practice/hub/AddSheet';
import { DayState } from '@/components/practice/hub/DayState';
import { HeartTop, MuraqabaLine, SelfMessageCard } from '@/components/practice/hub/HeartCards';
import { Cheer, DayDoneCard, StoryLine, WeekCard } from '@/components/practice/hub/KnowledgeCards';
import { PeriodicRows } from '@/components/practice/hub/PeriodicRows';
import { TodayList } from '@/components/practice/hub/TodayList';
import { WirdHeader } from '@/components/practice/hub/WirdHeader';
import { GUTTER, space, useStyles, type Theme } from '@/theme';
import { Button, Notice, Rule, Screen, Section, Skeleton, Text } from '@/ui';

const SKELETON_ROWS = ['r1', 'r2', 'r3'];
/** How many periodic acts the daily screen shows; the rest is behind «الكل». */
const UPCOMING_LIMIT = 3;

const makeStyles = (t: Theme) => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  content: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] + space.xl, gap: space['2xl'] },
  tight: { gap: space.xs },
  footer: { gap: space.md, alignItems: 'stretch' as const },
  skeletonHeader: { gap: space.sm },
  skeletonTop: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
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

const openPeriodic = () => router.push('/practice/periodic');
const openAddHabit = () => router.push('/practice/add');

export default function WirdScreen() {
  const hydrated = usePracticeStore((s) => s.hydrated);
  // Members only: the tab bar already asks a guest to sign in; this covers a link or a notification.
  const signedIn = useRequireSignIn('/(tabs)/habits');
  if (!signedIn) return <WirdSkeleton />;
  return hydrated ? <Wird /> : <WirdSkeleton />;
}

function Wird() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const catalog = usePracticeCatalog(locale);
  const { today } = useHubDays();

  const items = useDayAgenda(today);
  const rows = useAgendaRows(items, today, today);
  const offDayItems = useOffDayHabits(today);
  const offDayRows = useAgendaRows(offDayItems, today, today);
  const actions = useAgendaActions(today);
  const streak = useStreak(today);
  const periodic = usePeriodicRows(today);
  const upcoming = useMemo(() => upcomingPeriodic(periodic, today, UPCOMING_LIMIT), [periodic, today]);

  const [adding, setAdding] = useState(false);
  const handleAddOpen = useCallback(() => setAdding(true), []);
  const handleAddClose = useCallback(() => setAdding(false), []);
  const store = usePracticeStore((s) => s.store);
  const plans = store.plans;
  const usedMinimum = plans.some((plan) => minimumMet(plan, today));
  const habits = catalog.data?.habits;
  const usualDeed = useMemo(
    () => showUsualDeed(store, today, { isPeriodicAct: (plan) => habitFor(plan, habits ?? [])?.kind === 'periodic' }),
    [store, today, habits],
  );

  return (
    <Screen scroll={false} contentStyle={styles.frame}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader />
        <SelfMessageCard today={today} />
        <WirdHeader
          dateLabel={dateLine(today, names, hijriOffset, showHijri)}
          streak={streak.hasPlans ? streak.current : null}
          freshLine={streak.display.kind === 'fresh' ? t('practice.wird.streakFresh', { n: streak.display.longest }) : null}
          onAdd={handleAddOpen}
        />
        <MuraqabaLine today={today} />
        <HeartTop today={today} />

        {catalog.isError ? (
          <View style={styles.tight}>
            <Notice tone="destructive">{t('practice.catalogError')}</Notice>
            <Button label={t('common.retry')} onPress={() => void catalog.refetch()} variant="ghost" />
          </View>
        ) : null}

        <Rule />

        <TodayList
          title={t('practice.today')}
          date={today}
          today={today}
          rows={rows}
          offDayRows={offDayRows}
          canLog
          lastLog={actions.lastLog}
          onToggleHabit={actions.toggleHabit}
          onToggleRelative={actions.toggleRelative}
          onUndo={actions.undo}
          onMinimum={actions.logMinimum}
          onAddHabit={openAddHabit}
          footer={
            plans.length > 0 ? (
              <View style={styles.footer}>
                <Cheer at={actions.cheerAt} />
                <DayDoneCard today={today} />
                {/* A small-deed nudge once «أقل ما يمكن» kept a habit today (by id only; hidden until filled). */}
                {usedMinimum ? <StoryLine moment="smallDeed" /> : null}
                {/* Never right after «يومي ثقيل» / «عذر»: the day after, when the commitment before it is above 60%. */}
                {usualDeed ? <StoryLine moment="heavyDay" /> : null}
                <DayState today={today} />
              </View>
            ) : null
          }
        />

        <Rule />

        <Section
          title={t('practice.periodic.title')}
          action={
            periodic.length > 0 ? (
              <Button label={t('practice.periodic.all')} variant="outline" compact arrow onPress={openPeriodic} />
            ) : null
          }
        >
          {periodic.length === 0 ? (
            <Button label={t('practice.periodic.add')} icon={Plus} variant="outline" onPress={openPeriodic} />
          ) : upcoming.length > 0 ? (
            <PeriodicRows rows={upcoming} />
          ) : (
            <Text variant="small" tone="muted">
              {t('practice.periodic.noNext')}
            </Text>
          )}
        </Section>

        <WeekCard today={today} before={<Rule />} />
      </ScrollView>

      <AddSheet visible={adding} onClose={handleAddClose} />
    </Screen>
  );
}

/** The shape of «ورد اليوم» while the device store loads: title and «أضف», then three rows. */
function WirdSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen>
      <AppHeader />
      <View style={styles.skeletonHeader} accessibilityLabel={t('common.loading')}>
        <View style={styles.skeletonTop}>
          <Skeleton width="40%" height={30} />
          <Skeleton width={84} height={43} />
        </View>
        <Skeleton width="55%" height={14} />
      </View>
      <View>
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
    </Screen>
  );
}
