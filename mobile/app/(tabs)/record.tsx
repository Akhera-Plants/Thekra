/**
 * «عاداتي» (owner, 2026-11-01; the tab once called «السجل»): every habit the member keeps and what it needs, in two
 * parts so the page stays short:
 * - «العادات»: graduation offers, the habits being built (each with its days this month; a tap opens the plan, where it
 *   is edited or paused), «عادات راسخة», «موقوفة مؤقتًا» (with «استأنف»), «أضف عادة», the Ramadan season and
 *   «فروضي وأدواري»;
 * - «الإحصاء»: the streak and «أطول مداومة» (practice-core `currentStreak` / `longestStreak`), the one month calendar
 *   (a tapped day opens its list, loggable for the last 7 days) and «حصيلتي» per habit.
 * Ticking today's habits is «ورد اليوم»'s; the other screens (أعمال دورية، تخفَّف، المحاسبة، رفقة، المحفوظات…) are in the
 * side menu. The old «عاداتي» route (practice/habits) redirects here.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { Hourglass, Pause, Sprout, TreeDeciduous } from 'lucide-react-native';
import { establishPlan, graduationReady, isEstablished, isPaused, resumePlan, updatePlan, type LocalDate, type Plan } from '@thekra/practice-core';
import { pick } from '@/lib/practice/catalog-types';
import { habitFor } from '@/lib/practice/reminders';
import { planView } from '@/lib/practice/plan-view';
import { ExcuseChip } from '@/components/practice/hub/ExcuseChip';
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
  usePresenceMarks,
  useStreak,
} from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { AppHeader } from '@/components/nav/AppHeader';
import { RamadanBlock } from '@/components/practice/RamadanBlock';
import { PresenceMonth } from '@/components/practice/hub/PresenceMonth';
import { StreakFlame } from '@/components/practice/hub/StreakFlame';
import { TodayList } from '@/components/practice/hub/TodayList';
import { TallySection } from '@/components/practice/hub/KnowledgeCards';
import { space, useStyles, type Theme } from '@/theme';
import {
  Button,
  EmptyState,
  ListRow,
  Notice,
  PageHeader,
  Rule,
  Screen,
  Section,
  SegmentTabs,
  Skeleton,
  Text,
  type SegmentItem,
} from '@/ui';

type Part = 'habits' | 'stats';

const makeStyles = (t: Theme) => ({
  streak: { gap: space.xs },
  streakTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  streakNumber: { fontSize: 44, lineHeight: 56 },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  tight: { gap: space.xs },
});

const openAdd = () => router.push('/practice/add');
const openDuties = () => router.push('/practice/duties');

export default function MyHabitsScreen() {
  const { t } = useTranslation();
  const signedIn = useRequireSignIn('/(tabs)/record');
  const hydrated = usePracticeStore((s) => s.hydrated) && signedIn;
  const [part, setPart] = useState<Part>('habits');
  const parts: SegmentItem<Part>[] = [
    { key: 'habits', label: t('record.tabHabits') },
    { key: 'stats', label: t('record.tabStats') },
  ];
  return (
    <Screen decor="olive">
      <AppHeader />
      <PageHeader title={t('record.title')} />
      <SegmentTabs items={parts} value={part} onChange={setPart} />
      {!hydrated ? <Skeleton height={320} /> : part === 'habits' ? <HabitsPart /> : <StatsPart />}
    </Screen>
  );
}

/** «العادات»: each habit with its days this month and what it needs (open to edit or pause, resume, add). */
function HabitsPart() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const catalog = usePracticeCatalog(locale);
  const { today } = useHubDays();
  const habits = catalog.data?.habits ?? [];

  if (plans.length === 0) {
    return (
      <EmptyState icon={Sprout} message={t('practice.noPlans')} hint={t('practice.noPlansHint')} actionLabel={t('practice.addHabit')} onAction={openAdd} />
    );
  }

  const titleOf = (plan: Plan) => {
    const habit = habitFor(plan, habits);
    return habit ? pick(habit, 'title', locale) : plan.title;
  };
  const monthHint = (plan: Plan) => {
    const view = planView(plan, today);
    return t('practice.monthDays', { done: String(view.daysDone), count: view.targetDays });
  };
  const open = (plan: Plan) => router.push(`/practice/plan/${plan.id}`);
  const building = plans.filter((p) => !isPaused(p) && !isEstablished(p));
  const established = plans.filter((p) => !isPaused(p) && isEstablished(p));
  const paused = plans.filter(isPaused);

  return (
    <>
      {catalog.isError ? (
        <View style={styles.tight}>
          <Notice tone="destructive">{t('practice.catalogError')}</Notice>
          <Button label={t('common.retry')} onPress={() => void catalog.refetch()} variant="ghost" />
        </View>
      ) : null}

      <GraduationOffers today={today} />

      {building.length > 0 ? (
        <View style={styles.list}>
          {building.map((plan) => (
            <ListRow key={plan.id} icon={Sprout} title={titleOf(plan)} hint={monthHint(plan)} chevron onPress={() => open(plan)} />
          ))}
        </View>
      ) : null}

      {established.length > 0 ? (
        <Section title={t('practice.established.title')}>
          <View style={styles.list}>
            {established.map((plan) => (
              <ListRow key={plan.id} icon={TreeDeciduous} title={titleOf(plan)} hint={monthHint(plan)} chevron onPress={() => open(plan)} />
            ))}
          </View>
        </Section>
      ) : null}

      {paused.length > 0 ? (
        <Section title={t('practice.paused.title')}>
          <View style={styles.list}>
            {paused.map((plan) => (
              <ListRow
                key={plan.id}
                icon={Pause}
                title={titleOf(plan)}
                hint={t('practice.paused.since', { date: plan.pausedOn })}
                trailing={
                  <Button
                    label={t('practice.paused.resume')}
                    variant="ghost"
                    onPress={() => setStore((s) => updatePlan(s, plan.id, (p) => resumePlan(p, today)))}
                  />
                }
                onPress={() => open(plan)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Button label={t('practice.addHabit')} onPress={openAdd} arrow />
      <Rule />
      <RamadanBlock />
      <View style={styles.list}>
        <ListRow icon={Hourglass} title={t('practice.duties.title')} chevron onPress={openDuties} />
      </View>
    </>
  );
}

/** «الإحصاء»: the streak, the month calendar with a tapped day's list, and «حصيلتي». */
function StatsPart() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const catalog = usePracticeCatalog(locale);
  const { today, month, first, shiftMonth } = useHubDays();
  const streak = useStreak(today);
  const summary = useMonthPresence(today);
  const marks = usePresenceMarks(month, monthEnd(month), today);
  const occasions = useMemo(
    () => occasionDates(catalog.data?.occasions ?? [], month, monthEnd(month), hijriOffset),
    [catalog.data?.occasions, month, hijriOffset],
  );

  const [picked, setPicked] = useState<LocalDate | null>(null);
  const handleSelect = useCallback((date: LocalDate) => setPicked((p) => (p === date ? null : date)), []);

  return (
    <>
      {streak.display.kind === 'fresh' ? (
        <View style={styles.streakTop}>
          <StreakFlame size={26} />
          <Text variant="body">{t('practice.wird.streakFresh', { n: streak.display.longest })}</Text>
        </View>
      ) : (
        <View
          style={styles.streak}
          accessible
          accessibilityLabel={`${t('practice.wird.streakLabel', { count: streak.current })}. ${t('record.longest', { count: streak.longest })}`}
        >
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
      )}

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

      {picked ? <PickedDay date={picked} today={today} title={picked === today ? t('practice.today') : shortDayTitle(picked, names)} /> : null}

      <TallySection today={today} />
    </>
  );
}

/** The list of a day tapped in the month: the same rows as «ورد اليوم», loggable for the last 7 days. */
function PickedDay({ date, today, title }: { date: LocalDate; today: LocalDate; title: string }) {
  const { t } = useTranslation();
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
      footer={<ExcuseChip date={date} today={today} label={t('practice.excuse.day')} />}
    />
  );
}

/** «رسخت هذه العادة بفضل الله. انقلها إلى الراسخة؟» for each graduation-ready sapling: offered, never automatic. */
function GraduationOffers({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const ready = plans.filter((plan) => graduationReady(plan, today));
  return (
    <>
      {ready.map((plan) => {
        const habit = habitFor(plan, habits);
        return (
          <View key={plan.id} style={{ gap: space.sm }}>
            <Notice tone="muted">{`${habit ? pick(habit, 'title', locale) : plan.title} · ${t('practice.graduation.offer')}`}</Notice>
            <Button
              label={t('practice.graduation.action')}
              variant="outline"
              onPress={() => setStore((s) => updatePlan(s, plan.id, (p) => establishPlan(p, today)))}
            />
          </View>
        );
      })}
    </>
  );
}
