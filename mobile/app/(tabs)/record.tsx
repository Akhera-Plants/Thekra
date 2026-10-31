/**
 * «سجلّي», in this order: the streak (the number with the gold flame, and «أطول مداومة»; practice-core
 * `currentStreak` / `longestStreak`), the one month calendar (presence marks and occasion dots; a tapped day opens its
 * list under the grid, loggable for the last 7 days; a quiet link to the occasions calendar with its feed), then simple rows: «عاداتي» (habit management), «أعمال دورية»,
 * «تخفَّف» (the private program, behind its own lock), «بستاني», «رفقة» and «المحفوظات».
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bookmark, Flower2, Lock, Repeat, Sprout, Users, type LucideIcon } from 'lucide-react-native';
import type { LocalDate } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { monthEnd, shortDayTitle } from '@/lib/practice/calendar-grid';
import { canLogOn, occasionDates } from '@/lib/practice/hub';
import { usePracticeStore } from '@/lib/practice/practice-store';
import {
  useAgendaActions,
  useAgendaRows,
  useDateNames,
  useDayAgenda,
  useHubDays,
  useMonthPresence,
  useOffDayHabits,
  usePeriodicRows,
  usePresenceMarks,
  useStreak,
} from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { PresenceMonth } from '@/components/practice/hub/PresenceMonth';
import { StreakFlame } from '@/components/practice/hub/StreakFlame';
import { TodayList } from '@/components/practice/hub/TodayList';
import { space, useStyles, type Theme } from '@/theme';
import { ListRow, PageHeader, Screen, Skeleton, Text, TextLink } from '@/ui';

const makeStyles = (t: Theme) => ({
  streak: { gap: space.xs },
  streakTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  streakNumber: { fontSize: 44, lineHeight: 56 },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
});

interface LinkRow {
  key: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  href: Href;
}

const openCalendar = () => router.push('/practice/calendar');

export default function RecordScreen() {
  const { t } = useTranslation();
  const hydrated = usePracticeStore((s) => s.hydrated);
  return (
    <Screen decor>
      <PageHeader title={t('record.title')} />
      {hydrated ? <Record /> : <Skeleton height={320} />}
    </Screen>
  );
}

function Record() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const plans = usePracticeStore((s) => s.store.plans);
  const catalog = usePracticeCatalog(locale);
  const { today, month, first, shiftMonth } = useHubDays();
  const streak = useStreak(today);
  const summary = useMonthPresence(today);
  const periodic = usePeriodicRows(today);
  const marks = usePresenceMarks(month, monthEnd(month), today);
  const occasions = useMemo(
    () => occasionDates(catalog.data?.occasions ?? [], month, monthEnd(month), hijriOffset),
    [catalog.data?.occasions, month, hijriOffset],
  );

  const [picked, setPicked] = useState<LocalDate | null>(null);
  const handleSelect = useCallback((date: LocalDate) => setPicked((p) => (p === date ? null : date)), []);

  const links: LinkRow[] = [
    { key: 'habits', icon: Sprout, title: t('practice.hub.habitsTrack'), hint: t('practice.hub.habitsCount', { count: plans.length }), href: '/practice/habits' },
    { key: 'periodic', icon: Repeat, title: t('practice.periodic.title'), hint: t('record.periodicCount', { count: periodic.length }), href: '/practice/periodic' },
    { key: 'program', icon: Lock, title: t('sinProgram.title'), hint: t('record.programHint'), href: '/practice/sin-program' },
    { key: 'garden', icon: Flower2, title: t('garden.title'), hint: t('record.gardenHint'), href: '/garden' },
    { key: 'circles', icon: Users, title: t('circles.title'), hint: t('record.circlesHint'), href: '/circles' },
    { key: 'saved', icon: Bookmark, title: t('favorites.title'), hint: t('record.savedHint'), href: '/favorites' },
  ];

  return (
    <>
      <View style={styles.streak} accessible accessibilityLabel={`${t('practice.wird.streakLabel', { count: streak.current })}. ${t('record.longest', { count: streak.longest })}`}>
        <View style={styles.streakTop}>
          <StreakFlame size={34} />
          <Text variant="display" style={styles.streakNumber}>
            {String(streak.current)}
          </Text>
        </View>
        <Text variant="body">{t('record.current')}</Text>
        <Text variant="small" tone="muted">
          {t('record.longest', { count: streak.longest })}
        </Text>
      </View>

      <PresenceMonth
        summary={summary}
        month={month}
        first={first}
        today={today}
        selected={picked}
        showHijri={showHijri}
        marks={marks}
        occasions={occasions}
        onSelect={handleSelect}
        onShiftMonth={shiftMonth}
      />
      <TextLink label={t('record.occasionsCalendar')} onPress={openCalendar} muted />

      {picked ? <PickedDay date={picked} today={today} title={picked === today ? t('practice.today') : shortDayTitle(picked, names)} /> : null}

      <View style={styles.list}>
        {links.map((link) => (
          <ListRow key={link.key} icon={link.icon} title={link.title} hint={link.hint} onPress={() => router.push(link.href)} />
        ))}
      </View>
    </>
  );
}

/** The list of a day tapped in the month: the same rows as «ورد اليوم», loggable for the last 7 days. */
function PickedDay({ date, today, title }: { date: LocalDate; today: LocalDate; title: string }) {
  const items = useDayAgenda(date);
  const rows = useAgendaRows(items, date, today);
  const offDayItems = useOffDayHabits(date);
  const offDayRows = useAgendaRows(offDayItems, date, today);
  const actions = useAgendaActions(date);
  return (
    <TodayList
      title={title}
      date={date}
      today={today}
      rows={rows}
      offDayRows={offDayRows}
      canLog={canLogOn(date, today)}
      lastLog={actions.lastLog}
      onToggleHabit={actions.toggleHabit}
      onToggleRelative={actions.toggleRelative}
      onUndo={actions.undo}
    />
  );
}
