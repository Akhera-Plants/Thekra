/**
 * «ورد اليوم» (the centre tab), top to bottom and nothing else:
 * 0. on a Friday, last week's «رسالة إلى نفسي» first; under the header one rotating text (المراقبة) and the cards of
 *    «نية اليوم», a due «التزام شخصي» and «المحاسبة» (components/practice/hub/HeartCards.tsx);
 * 1. the title, one date line (Gregorian; Hijri too with «إظهار التاريخ الهجري»), the streak chip and «أضف»;
 * 2. «اليوم»: today's sunnah occasion as one compact line, then one row per task from practice-core `dayAgenda`
 *    (habits asked for today, relatives due as periodic acts, the generic private check-in), done rows at the bottom;
 *    habits not asked for today behind ONE collapsed row; «يومي ثقيل» as a compact chip at the end (today only,
 *    practice-core `isEbbOn`);
 * 3. «أعمال دورية»: the next three periodic acts with their dates and «الكل»;
 * 4. «شعبة الأسبوع» (one branch of faith per ISO week). A tick shows «تقبّل الله منك» with a light haptic; a complete
 *    day shows «تمّ وردك اليوم» with one reward text; stories appear at their moments (by id only).
 * The month calendar, the habit management, «تخفَّف», «بستاني», «رفقة» and the saved texts live in «سجلّي».
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePracticeCatalog } from '@/lib/api/practice';
import { dateLine } from '@/lib/practice/calendar-grid';
import { usePracticeStore } from '@/lib/practice/practice-store';
import {
  useAgendaActions,
  useAgendaRows,
  useDateNames,
  useDayAgenda,
  useHeavyDay,
  useHubDays,
  useOffDayHabits,
  usePeriodicRows,
  useStreak,
} from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { upcomingPeriodic } from '@/lib/practice/wird';
import { addDays, minimumMet } from '@thekra/practice-core';
import { AddSheet } from '@/components/practice/hub/AddSheet';
import { ExcuseChip } from '@/components/practice/hub/ExcuseChip';
import { HeartTop, MuraqabaLine, SelfMessageCard } from '@/components/practice/hub/HeartCards';
import { Cheer, DayDoneCard, StoryLine, WeekBranchCard } from '@/components/practice/hub/KnowledgeCards';
import { PeriodicRows } from '@/components/practice/hub/PeriodicRows';
import { TodayList } from '@/components/practice/hub/TodayList';
import { WirdHeader } from '@/components/practice/hub/WirdHeader';
import { GUTTER, space, useStyles, type Theme } from '@/theme';
import { Button, Chip, Notice, Screen, Skeleton, Text, TextLink } from '@/ui';

const SKELETON_ROWS = ['r1', 'r2', 'r3'];
/** How many periodic acts the daily screen shows; the rest is behind «الكل». */
const UPCOMING_LIMIT = 3;

const makeStyles = (t: Theme) => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  content: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] + space.xl, gap: space['2xl'] },
  tight: { gap: space.xs },
  section: { gap: space.md },
  sectionHead: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  heavy: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
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
  const heavyDay = useHeavyDay(today);
  const streak = useStreak(today);
  const periodic = usePeriodicRows(today);
  const upcoming = useMemo(() => upcomingPeriodic(periodic, today, UPCOMING_LIMIT), [periodic, today]);

  const [adding, setAdding] = useState(false);
  const handleAddOpen = useCallback(() => setAdding(true), []);
  const handleAddClose = useCallback(() => setAdding(false), []);
  const toggleHeavy = useCallback(() => heavyDay.setHeavy(!heavyDay.heavy), [heavyDay]);
  const plans = usePracticeStore((s) => s.store.plans);
  const usedMinimum = plans.some((plan) => minimumMet(plan, today));

  return (
    <Screen scroll={false} contentStyle={styles.frame} decor>
      <ScrollView contentContainerStyle={styles.content}>
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
            heavyDay.hasPlans ? (
              <View style={styles.section}>
                <Cheer at={actions.cheerAt} />
                <DayDoneCard today={today} />
                {/* A small-deed nudge once «أقل ما يمكن» kept a habit today (by id only; hidden until filled). */}
                {usedMinimum ? <StoryLine moment="smallDeed" /> : null}
                <View style={styles.heavy}>
                  <Chip label={t('practice.heavyDay')} selected={heavyDay.heavy} onPress={toggleHeavy} />
                  <ExcuseChip date={today} today={today} label={t('practice.excuse.today')} />
                  <ExcuseChip date={addDays(today, -1)} today={today} label={t('practice.excuse.yesterday')} />
                </View>
                {heavyDay.heavy ? <StoryLine moment="heavyDay" /> : null}
              </View>
            ) : null
          }
        />

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="title" accessibilityRole="header">
              {t('practice.periodic.title')}
            </Text>
            {periodic.length > 0 ? <TextLink label={t('practice.periodic.all')} onPress={openPeriodic} /> : null}
          </View>
          {periodic.length === 0 ? (
            <TextLink label={t('practice.periodic.add')} onPress={openPeriodic} />
          ) : upcoming.length > 0 ? (
            <PeriodicRows rows={upcoming} />
          ) : null}
        </View>

        <WeekBranchCard today={today} />
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
    <Screen decor>
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
