/**
 * «عاداتي»: the hub of the practice tracks (docs: hub spec; roadmap §0 rules; lecture analysis §8). It opens on today:
 * the title with the day in Hijri and Gregorian, «أضف» (a sheet: habit, relative, program) and the calendar; the week
 * strip with presence marks; the day's list across tracks with check controls (practice-core `dayAgenda`); «يومي
 * ثقيل»; the three tracks (or the three ways to begin); «وين وصلت هذا الشهر» as a month grid. No streaks, no
 * failure words; the private program shows only as one generic line. Habit management lives on «طاعاتي».
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePracticeCatalog } from '@/lib/api/practice';
import { dayTitle, monthEnd, shortDayTitle } from '@/lib/practice/calendar-grid';
import { canLogOn, isDayComplete, occasionDates } from '@/lib/practice/hub';
import { usePracticeStore } from '@/lib/practice/practice-store';
import {
  useAgendaActions,
  useAgendaRows,
  useDateNames,
  useDayAgenda,
  useHeavyDay,
  useHubDays,
  usePresenceMarks,
  useTrackSummary,
} from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { AddSheet } from '@/components/practice/hub/AddSheet';
import { DayAgenda } from '@/components/practice/hub/DayAgenda';
import { HubHeader } from '@/components/practice/hub/HubHeader';
import { PresenceMonth } from '@/components/practice/hub/PresenceMonth';
import { TrackRows } from '@/components/practice/hub/TrackRows';
import { WeekStrip } from '@/components/practice/hub/WeekStrip';
import { GUTTER, space, useStyles, type Theme } from '@/theme';
import { Button, Notice, Ornament, Screen, Skeleton, SwitchRow } from '@/ui';

const SKELETON_DAYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
const SKELETON_ROWS = ['r1', 'r2', 'r3'];

const makeStyles = (t: Theme) => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  content: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['4xl'] + space.xl, gap: space['2xl'] },
  tight: { gap: space.xs },
  skeletonHeader: { gap: space.sm },
  skeletonTop: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  skeletonWeek: { flexDirection: 'row' as const, gap: space.xs },
  skeletonDay: { flex: 1 },
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

export default function HabitsHubScreen() {
  const hydrated = usePracticeStore((s) => s.hydrated);
  return hydrated ? <HabitsHub /> : <HubSkeleton />;
}

function HabitsHub() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const catalog = usePracticeCatalog(locale);
  const { today, selected, month, week, first, select, shiftWeek, shiftMonth, goToday } = useHubDays();

  const items = useDayAgenda(selected);
  const rows = useAgendaRows(items, selected, today);
  const actions = useAgendaActions(selected);
  const weekMarks = usePresenceMarks(week[0]!, week[6]!, today);
  const monthMarks = usePresenceMarks(month, monthEnd(month), today);
  const summary = useTrackSummary(today);
  const heavyDay = useHeavyDay();
  const monthOccasions = useMemo(
    () => occasionDates(catalog.data?.occasions ?? [], month, monthEnd(month), hijriOffset),
    [catalog.data?.occasions, month, hijriOffset],
  );

  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef(0);

  const handleListLayout = useCallback((e: LayoutChangeEvent) => {
    listY.current = e.nativeEvent.layout.y;
  }, []);
  const handleGridSelect = useCallback(
    (date: string) => {
      select(date);
      scrollRef.current?.scrollTo({ y: Math.max(0, listY.current - space.lg), animated: true });
    },
    [select],
  );
  const handleAddOpen = useCallback(() => setAdding(true), []);
  const handleAddClose = useCallback(() => setAdding(false), []);
  const handleCalendar = useCallback(() => router.push('/practice/calendar'), []);

  const listTitle = selected === today ? t('practice.today') : shortDayTitle(selected, names);

  return (
    <Screen scroll={false} contentStyle={styles.frame} decor>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <HubHeader dateLabel={dayTitle(selected, hijriOffset, names)} onCalendar={handleCalendar} onAdd={handleAddOpen} />

        {summary.started ? null : <TrackRows summary={summary} />}

        <WeekStrip
          week={week}
          today={today}
          selected={selected}
          marks={weekMarks}
          onSelect={select}
          onShiftWeek={shiftWeek}
          onToday={goToday}
        />

        {catalog.isError ? (
          <View style={styles.tight}>
            <Notice tone="destructive">{t('practice.catalogError')}</Notice>
            <Button label={t('common.retry')} onPress={() => void catalog.refetch()} variant="ghost" />
          </View>
        ) : null}

        <View onLayout={handleListLayout}>
          <DayAgenda
            title={listTitle}
            date={selected}
            today={today}
            rows={rows}
            canLog={canLogOn(selected, today)}
            complete={selected <= today && isDayComplete(items)}
            started={summary.started}
            lastLog={actions.lastLog}
            onToggleHabit={actions.toggleHabit}
            onToggleRelative={actions.toggleRelative}
            onUndo={actions.undo}
          />
        </View>

        {heavyDay.hasPlans ? (
          <SwitchRow
            label={t('practice.heavyDay')}
            hint={t('practice.heavyDayHint')}
            value={heavyDay.heavy}
            onValueChange={heavyDay.setHeavy}
          />
        ) : null}

        {summary.started ? (
          <>
            <Ornament />
            <TrackRows summary={summary} />
            <PresenceMonth
              summary={summary}
              month={month}
              first={first}
              today={today}
              selected={selected}
              marks={monthMarks}
              occasions={monthOccasions}
              onSelect={handleGridSelect}
              onShiftMonth={shiftMonth}
            />
          </>
        ) : null}
      </ScrollView>

      <AddSheet visible={adding} onClose={handleAddClose} />
    </Screen>
  );
}

/** The shape of the hub while the device store loads: title and «أضف», the week tiles, three rows. */
function HubSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen decor>
      <View style={styles.skeletonHeader} accessibilityLabel={t('common.loading')}>
        <View style={styles.skeletonTop}>
          <Skeleton width="35%" height={30} />
          <Skeleton width={84} height={43} />
        </View>
        <Skeleton width="70%" height={14} />
      </View>
      <View style={styles.skeletonWeek}>
        {SKELETON_DAYS.map((key) => (
          <View key={key} style={styles.skeletonDay}>
            <Skeleton height={76} />
          </View>
        ))}
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
