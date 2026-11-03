/**
 * «عاداتي» (owner, 2026-11-01; the tab once called «السجل»): doing good and leaving sins, in two parts so the page
 * stays short:
 * - «العادات»: «طاعات أداوم عليها» (graduation offers, the habits being built, «عادات راسخة», «موقوفة مؤقتًا», «أضف
 *   عادة»; each row opens its plan and ends in the action that fits today: «سجّل» when asked and not logged, «تمّ» when
 *   done, a quiet «سجّل» on a day it is not asked, «استأنف» when paused), then «معاصٍ أتخفّف منها» (each running «تخفَّف»
 *   program with its stage and days held, generic words only, opening the locked program screen), «وضع رمضان» (in
 *   Ramadan only) and «فروضي وأدواري»;
 * - «الإحصاء»: the streak and «أطول مداومة» in one compact row (practice-core `currentStreak` / `longestStreak`), the one month calendar
 *   (a tapped day opens its list, loggable for the last 7 days) and «حصيلتي» per habit.
 * Owner round 3: a missed habit's row offers «صلّحها» (the «خربانة؟ صلّحها» steps, HabitFixSheet), a program row after a
 * weak day too; «ابنِ حلقة عادتك الخاصة» opens the loop builder; periodic acts stay in «أعمال دورية» (reminders, not
 * habits); «الإحصاء» adds «نسبة الالتزام» per habit (CommitmentChart); a hairline rule divides the sections.
 * «استراتيجيات العادات» opens from the top of «العادات» (owner, 2026-11-03: it is central to the app, so it gets a
 * prominent home, as habit apps put their tips above the list), first row of a small «أدوات العادة» group with
 * «ابنِ حلقة عادتك الخاصة» (two hairline rows); it stays in the side menu too.
 * The other screens (أعمال دورية، المحاسبة، رفقة، المحفوظات…) are in the side menu. The old «عاداتي» route
 * (practice/habits) redirects here.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { DoorOpen, Hourglass, Lightbulb, Pause, Plus, Repeat, Sprout, TreeDeciduous } from 'lucide-react-native';
import {
  activePrograms,
  establishPlan,
  graduationReady,
  isEstablished,
  isPaused,
  missedDayBefore,
  resumePlan,
  updatePlan,
  type HabitItem,
  type LocalDate,
  type Plan,
} from '@thekra/practice-core';
import { habitDayAction, habitNeedsFix, programRows } from '@/lib/practice/my-habits';
import { listedStrategies } from '@/lib/practice/strategies';
import { HabitFixSheet } from '@/components/practice/HabitFixSheet';
import { CommitmentChart } from '@/components/practice/hub/CommitmentChart';
import { HabitActionRow, ProgramActionRow } from '@/components/practice/MyHabitsRows';
import { pick } from '@/lib/practice/catalog-types';
import { habitFor } from '@/lib/practice/reminders';
import { planView } from '@/lib/practice/plan-view';
import { ExcuseChip } from '@/components/practice/hub/ExcuseChip';
import { usePracticeCatalog } from '@/lib/api/practice';
import { monthEnd, shortDayTitle } from '@/lib/practice/calendar-grid';
import { shortDate } from '@/lib/practice/format';
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
  usePlanDays,
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
  streakTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  /** The streak in one row (flame, number, label, «أطول: n») so the month shows without scrolling. */
  streakRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  streakNumber: { fontVariant: ['tabular-nums' as const] },
  streakLabel: { flex: 1 },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  tight: { gap: space.xs },
  empty: { gap: space.md, alignItems: 'flex-start' as const },
  subTitle: { paddingTop: space.sm, paddingBottom: space.xs },
});

const openAdd = () => router.push('/practice/add');
const openDuties = () => router.push('/practice/duties');
const openProgram = () => router.push('/practice/sin-program');
const openLoops = () => router.push('/practice/loops');
const openStrategies = () => router.push('/practice/strategies');

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
    <Screen>
      <AppHeader />
      <PageHeader title={t('record.title')} />
      <SegmentTabs items={parts} value={part} onChange={setPart} />
      {!hydrated ? <Skeleton height={320} /> : part === 'habits' ? <HabitsPart /> : <StatsPart />}
    </Screen>
  );
}

/** «العادات»: «طاعات أداوم عليها», «معاصٍ أتخفّف منها», «وضع رمضان» (in Ramadan) and «فروضي وأدواري». */
function HabitsPart() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const catalog = usePracticeCatalog(useUiLocale());
  return (
    <>
      {catalog.isError ? (
        <View style={styles.tight}>
          <Notice tone="destructive">{t('practice.catalogError')}</Notice>
          <Button label={t('common.retry')} onPress={() => void catalog.refetch()} variant="ghost" />
        </View>
      ) : null}
      <ToolsSection />
      <Rule />
      <DeedsSection />
      <Rule />
      <ProgramsSection />
      <RamadanBlock />
      <Rule />
      <ListRow icon={Hourglass} title={t('practice.duties.title')} chevron onPress={openDuties} />
    </>
  );
}

/** «أدوات العادة»: «استراتيجيات العادات» (with how many strategies it holds) and «ابنِ حلقة عادتك الخاصة», two hairline rows. */
function ToolsSection() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const count = listedStrategies().length;
  return (
    <Section title={t('myHabits.toolsTitle')}>
      <View style={styles.list}>
        <ListRow
          icon={Lightbulb}
          title={t('practice.strategies.title')}
          hint={t('practice.strategies.entryHint', { count })}
          chevron
          onPress={openStrategies}
        />
        <ListRow icon={Repeat} title={t('loops.habit.pageTitle')} hint={t('loops.habit.rowHint')} chevron onPress={openLoops} />
      </View>
    </Section>
  );
}

/** «طاعات أداوم عليها»: the habits, each with today's action; «أضف عادة». */
function DeedsSection() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  // Periodic acts are reminders with their own screen («أعمال دورية»), never listed as habits (owner round 3).
  const plans = store.plans.filter((p) => habitFor(p, habits)?.kind !== 'periodic');
  const planDays = usePlanDays();
  const { today } = useHubDays();
  const [fixing, setFixing] = useState<string | null>(null);
  const fixPlan = plans.find((p) => p.id === fixing);
  // Today's items, the same as «ورد اليوم»: asked for today, and the habits not asked today (still loggable).
  const agenda = useDayAgenda(today);
  const offDay = useOffDayHabits(today);
  const actions = useAgendaActions(today);
  const dueById = useMemo(() => byPlan(agenda.filter((i): i is HabitItem => i.kind === 'habit')), [agenda]);
  const offById = useMemo(() => byPlan(offDay), [offDay]);

  const titleOf = (plan: Plan) => {
    const habit = habitFor(plan, habits);
    return habit ? pick(habit, 'title', locale) : plan.title;
  };
  const monthHint = (plan: Plan) => {
    const view = planView(plan, today);
    return t('practice.monthDays', { done: String(view.daysDone), count: view.targetDays });
  };
  const open = (plan: Plan) => router.push(`/practice/plan/${plan.id}`);
  const row = (plan: Plan, icon: typeof Sprout, hint: string) => {
    const paused = isPaused(plan);
    const due = dueById.get(plan.id);
    const off = offById.get(plan.id);
    const action = habitDayAction({ paused, due, offDay: off });
    const item = due ?? off;
    const needsFix = habitNeedsFix({ paused, missedYesterday: missedDayBefore(store, plan, today, planDays), doneToday: plan.log[today] ?? 0 });
    return (
      <HabitActionRow
        key={plan.id}
        icon={icon}
        title={titleOf(plan)}
        hint={hint}
        action={action}
        onOpen={() => open(plan)}
        undo={
          actions.lastLog?.kind === 'habit' && actions.lastLog.planId === plan.id
            ? { cleared: actions.lastLog.cleared, onUndo: actions.undo }
            : null
        }
        onFix={needsFix ? () => setFixing(plan.id) : undefined}
        onAction={() => {
          if (action === 'resume') setStore((s) => updatePlan(s, plan.id, (p) => resumePlan(p, today)));
          else if (item) actions.toggleHabit(item);
        }}
      />
    );
  };
  const building = plans.filter((p) => !isPaused(p) && !isEstablished(p));
  const established = plans.filter((p) => !isPaused(p) && isEstablished(p));
  const paused = plans.filter(isPaused);

  return (
    <Section title={t('myHabits.deedsTitle')}>
      <GraduationOffers today={today} />
      {plans.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" tone="muted">
            {t('practice.noPlans')}
          </Text>
          <Button label={t('practice.addHabit')} icon={Plus} onPress={openAdd} />
        </View>
      ) : (
        <>
          {building.length > 0 ? <View style={styles.list}>{building.map((plan) => row(plan, Sprout, monthHint(plan)))}</View> : null}
          {established.length > 0 ? (
            <View>
              <Text variant="heading" accessibilityRole="header" style={styles.subTitle}>
                {t('practice.established.title')}
              </Text>
              <View style={styles.list}>{established.map((plan) => row(plan, TreeDeciduous, monthHint(plan)))}</View>
            </View>
          ) : null}
          {paused.length > 0 ? (
            <View>
              <Text variant="heading" accessibilityRole="header" style={styles.subTitle}>
                {t('practice.paused.title')}
              </Text>
              <View style={styles.list}>
                {paused.map((plan) => row(plan, Pause, t('practice.paused.since', { date: plan.pausedOn ? shortDate(plan.pausedOn) : '' })))}
              </View>
            </View>
          ) : null}
          <Button label={t('practice.addHabit')} icon={Plus} onPress={openAdd} variant="outline" />
        </>
      )}
      <HabitFixSheet
        visible={fixPlan !== undefined}
        onClose={() => setFixing(null)}
        plan={fixPlan}
        habit={fixPlan ? habitFor(fixPlan, habits) : undefined}
        title={fixPlan ? titleOf(fixPlan) : ''}
        today={today}
      />
    </Section>
  );
}

/** Today's habit items by plan id. */
function byPlan(items: readonly HabitItem[]): Map<string, HabitItem> {
  return new Map(items.map((item) => [item.planId, item]));
}

/** «معاصٍ أتخفّف منها»: each running «تخفَّف» program, generic words only; «ابدأ «تخفَّف»» when none runs. */
function ProgramsSection() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const programs = usePracticeStore((s) => s.store.programs);
  const stages = usePracticeCatalog(locale).data?.sinPrograms.common.stages;
  const { today } = useHubDays();
  const rows = useMemo(() => programRows(activePrograms(programs), today), [programs, today]);

  return (
    <Section title={t('myHabits.programsTitle')}>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" tone="muted">
            {t('myHabits.noProgram')}
          </Text>
          <Button label={t('reminders.startProgram')} icon={Plus} onPress={openProgram} variant="outline" />
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((model, index) => {
            const content = stages?.[model.stageKey];
            return (
              <ProgramActionRow
                key={model.key}
                icon={DoorOpen}
                model={model}
                title={rows.length > 1 ? t('myHabits.programN', { n: String(index + 1) }) : t('myHabits.program')}
                stageTitle={content ? pick(content, 'title', locale) : undefined}
                onOpen={openProgram}
              />
            );
          })}
        </View>
      )}
    </Section>
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
          style={styles.streakRow}
          accessible
          accessibilityLabel={`${t('practice.wird.streakLabel', { count: streak.current })}. ${t('record.longest', { count: streak.longest })}`}
        >
          <StreakFlame size={24} />
          <Text variant="title" style={styles.streakNumber}>
            {String(streak.current)}
          </Text>
          <Text variant="body" style={styles.streakLabel} numberOfLines={1}>
            {t('record.current')}
          </Text>
          <Text variant="small" tone="muted">
            {t('record.longestShort', { count: streak.longest })}
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

      <Rule />
      <CommitmentChart today={today} />
      <Rule />
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
