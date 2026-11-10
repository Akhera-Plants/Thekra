/**
 * «عاداتي › اليوم» (owner round 6, §2; C-02a, C-01r, C-01j, C-01a, C-01b; the reference's layout, our kit), top to
 * bottom:
 * 1. the week strip (from the review day; a past day opens its details and asks, `DaySheet`);
 * 2. the day's title (Hijri and the next prayer under it) with «حال يومي» and the ONE «أضف»;
 * 3. on a hard day the gentle line «سامح نفسك اليوم، وأدِّ القدر الأدنى» (the habits then ask their minimum);
 * 4. the groups «الفرائض · عادات اليوم · الأعمال الدورية» right under the title: a badge row picks one on a phone, so
 *    no group needs scrolling to reach; from {@link SIDE_BY_SIDE_WIDTH} they show side by side. «عادات اليوم» opens
 *    with «هل فعلتها؟» for the past days still in the ask window (practice-core `pendingAsks`: فعلتها / لم أفعل), then
 *    the habits banded بداية / خلال / ختام اليوم with the inline counter; «صلّحها» only on a row in the gap context;
 *    «قضاء الفوائت» is inside «الفرائض»;
 * 5. ONE heart card (practice-core `heartSlot`), as in the reference (after the day's list);
 * 6. one collapsed «المزيد لليوم», «صحبتك» for circle members, the widget line.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Leaf, Plus, Repeat, Users } from 'lucide-react-native';
import {
  activePrograms,
  addDays,
  answerDidIt,
  answerDidNot,
  dayStateOn,
  fardEnabled,
  fardOn,
  FARD_PRAYERS,
  isPaused,
  logForDay,
  makeUpOffer,
  missedDayBefore,
  nextPrayer,
  nextPrayerLine,
  pendingAsks,
  qadaProgress,
  resolveHomeSections,
  setFardTracking,
  updatePlan,
  type HabitItem,
  type LocalDate,
} from '@thekra/practice-core';
import { useCircle, useMyCircles } from '@/lib/api/circles';
import { usePracticeCatalog } from '@/lib/api/practice';
import { safeHijri, shortDayTitle } from '@/lib/practice/calendar-grid';
import { nowTime } from '@/lib/practice/format';
import { mendState, showsMend } from '@/lib/practice/habits-view';
import { bandOf, byBand, dayStateLightenKey, dayStateLineKey, DEFAULT_TODAY_GROUP, SIDE_BY_SIDE_WIDTH, TODAY_GROUPS, type TodayGroup } from '@/lib/practice/hub-view';
import { currentPrayerLookup } from '@/lib/practice/prayer';
import { today as todayFn, usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useAgendaActions, useAgendaRows, useDateNames, useDayAgenda, useOffDayHabits, usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import type { AgendaRowModel } from '@/lib/practice/wird';
import { HabitFixSheet } from '@/components/practice/HabitFixSheet';
import { DayState } from '@/components/practice/hub/DayState';
import { HeartSlotCard, planTitleOf } from '@/components/practice/hub/HeartCards';
import { Cheer, DayDoneCard, TallySection, WeekBranchCard } from '@/components/practice/hub/KnowledgeCards';
import { OccasionRow, ProgramRow } from '@/components/practice/hub/AgendaRows';
import { TodayList } from '@/components/practice/hub/TodayList';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, ButtonPair, ForwardArrow, Icon, ListRow, Notice, SectionDivider, SegmentTabs, Text, toast } from '@/ui';
import { WidgetIntroLine } from '@/widget/WidgetIntro';
import { DaySheet } from './DaySheet';
import { FardSection } from './FardSection';
import { QadaRing } from './QadaRing';
import { TodayHabitRow } from './TodayRows';
import { useNow } from './use-now';
import { WeekStrip } from './WeekStrip';

const makeStyles = (t: Theme) => ({
  root: { gap: space['2xl'] },
  tight: { gap: space.xs },
  head: { gap: 2 },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  title: { flex: 1, minWidth: 0 },
  groups: { gap: space.lg },
  columns: { flexDirection: 'row' as const, gap: space['2xl'], alignItems: 'flex-start' as const },
  column: { flex: 1, minWidth: 0, gap: space.md },
  band: { gap: 2 },
  bandTitle: { paddingTop: space.sm },
  asks: { gap: space.sm, marginBottom: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  ask: { gap: space.sm, paddingVertical: space.xs },
  toggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  togglePressed: { backgroundColor: t.colors.accent, borderRadius: radius.control },
  toggleText: { flex: 1 },
  more: { gap: space.lg, paddingTop: space.md },
  qada: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, paddingVertical: space.sm },
  qadaText: { flex: 1, minWidth: 0, gap: 2 },
});

export function TodayTab({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const wide = width >= SIDE_BY_SIDE_WIDTH;
  const store = usePracticeStore((s) => s.store);
  const [group, setGroup] = useState<TodayGroup>(DEFAULT_TODAY_GROUP);
  const [openDay, setOpenDay] = useState<LocalDate | null>(null);
  const day = dayStateOn(store, today);
  const lineKey = dayStateLineKey(day);
  const lightenKey = dayStateLightenKey(day, activePrograms(store.programs).length > 0);
  const model = useTodayModel(today);

  const counts: Record<TodayGroup, number | undefined> = {
    fard: fardEnabled(store) ? FARD_PRAYERS.filter((p) => fardOn(store, today)[p] === null).length : undefined,
    habits: model.habitRows.filter((r) => r.kind === 'habit' && !r.item.complete).length,
    periodic: model.periodicRows.length,
  };
  const items = TODAY_GROUPS.map((key) => ({ key, label: t(`habitsHub.today.groups.${key}`), count: counts[key] }));
  const groupView = (key: TodayGroup) =>
    key === 'fard' ? <FardGroup today={today} /> : key === 'habits' ? <HabitsGroup today={today} model={model} /> : <PeriodicGroup today={today} model={model} />;

  return (
    <View style={styles.root}>
      <WeekStrip today={today} onOpenDay={setOpenDay} />
      <View style={styles.tight}>
        <TitleRow today={today} />
        {lineKey ? (
          <Notice icon={Leaf}>
            {lightenKey ? `${t(lineKey)}\n${t(lightenKey)}` : t(lineKey)}
          </Notice>
        ) : null}
      </View>
      {wide ? (
        <View style={styles.columns}>
          {TODAY_GROUPS.map((key) => (
            <View key={key} style={styles.column}>
              <Text variant="title" accessibilityRole="header">
                {t(`habitsHub.today.groups.${key}`)}
              </Text>
              {groupView(key)}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.groups}>
          <SegmentTabs items={items} value={group} onChange={setGroup} />
          {groupView(group)}
        </View>
      )}

      <HeartSlotCard today={today} />
      {store.plans.length > 0 ? <MoreForToday today={today} /> : null}
      <CirclesLine today={today} />
      <WidgetIntroLine />
      <DaySheet date={openDay} onClose={() => setOpenDay(null)} />
    </View>
  );
}

interface TodayModel {
  habitRows: AgendaRowModel[];
  offDayRows: AgendaRowModel[];
  periodicRows: AgendaRowModel[];
  actions: ReturnType<typeof useAgendaActions>;
}

/** Today's agenda split into habits (with the private check-in and the occasion) and the periodic acts due. */
function useTodayModel(today: LocalDate): TodayModel {
  const locale = useUiLocale();
  const habits = usePracticeCatalog(locale).data?.habits;
  const plans = usePracticeStore((s) => s.store.plans);
  const items = useDayAgenda(today);
  const rows = useAgendaRows(items, today, today);
  const offDayItems = useOffDayHabits(today);
  const offDay = useAgendaRows(offDayItems, today, today);
  const actions = useAgendaActions(today);
  return useMemo(() => {
    const isPeriodicPlan = (planId: string) => {
      const plan = plans.find((p) => p.id === planId);
      return plan ? plan.habitKey === 'custom-periodic' || habitFor(plan, habits ?? [])?.kind === 'periodic' : false;
    };
    const isPeriodicRow = (row: AgendaRowModel) => row.kind === 'relative' || (row.kind === 'habit' && isPeriodicPlan(row.item.planId));
    return {
      habitRows: rows.filter((r) => !isPeriodicRow(r)),
      offDayRows: offDay.filter((r) => !isPeriodicRow(r)),
      periodicRows: rows.filter(isPeriodicRow),
      actions,
    };
  }, [rows, offDay, plans, habits, actions]);
}

/** The date, the Hijri date and the next prayer; «حال يومي» and the one «أضف» on its line. */
function TitleRow({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const hasCity = usePracticeStore((s) => s.prefs.prayer !== null);
  usePracticeStore((s) => s.prefs.prayerCache);
  const now = useNow();
  const prayerLine = useMemo(() => {
    if (!hasCity) return null;
    const lookup = currentPrayerLookup();
    const times = lookup(today);
    if (!times) return null;
    try {
      return nextPrayerLine(nextPrayer(times, nowTime(now), lookup(addDays(today, 1))), locale);
    } catch {
      return null;
    }
  }, [hasCity, today, now, locale]);
  const hijri = showHijri ? safeHijri(today, hijriOffset) : null;
  const sub = [hijri ? `${hijri.day} ${names.hijriMonth(hijri.month)} ${hijri.year}` : null, prayerLine].filter(Boolean).join(' · ');
  return (
    <View style={styles.head}>
      <View style={styles.top}>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {shortDayTitle(today, names)}
        </Text>
        <DayState today={today} />
        <Button label={t('practice.hub.add')} icon={Plus} onPress={() => router.push('/practice/add')} variant="solid" size="sm" accessibilityLabel={t('practice.addHabit')} />
      </View>
      {sub ? (
        <Text variant="small" tone="muted">
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** «هل فعلتها؟» for every habit of the last days without a log (no empty entries, C-01j); `planId` keeps one habit's. */
export function PendingAsks({ today, planId: only }: { today: LocalDate; planId?: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const asks = useMemo(
    () => pendingAsks(store, today, { ...planDays, isPeriodicAct: (p) => habitFor(p, habits)?.kind === 'periodic' }).filter((a) => only === undefined || a.planId === only),
    [store, today, planDays, habits, only],
  );
  if (asks.length === 0) return null;
  const yesterday = addDays(today, -1);
  return (
    <View style={styles.asks}>
      <Text variant="heading" accessibilityRole="header">
        {t('habitsHub.ask.title')}
      </Text>
      {asks.map(({ planId, date }) => {
        const plan = store.plans.find((p) => p.id === planId);
        if (!plan) return null;
        const title = planTitleOf(plan, habits, locale);
        const when = date === yesterday ? t('habitsHub.ask.yesterday') : shortDayTitle(date, names);
        return (
          <View key={`${planId}|${date}`} style={styles.ask}>
            <Text variant="body">
              {title}
              <Text variant="small" tone="muted">{` · ${when}`}</Text>
            </Text>
            <ButtonPair
              primary={{
                label: t('habitsHub.ask.did'),
                variant: 'outline',
                onPress: () => {
                  setStore((s) => updatePlan(s, planId, (p) => answerDidIt(s, p, date, todayFn())));
                  toast(t('habitsHub.day.didToast', { habit: title }));
                },
              }}
              secondary={{
                label: t('habitsHub.ask.didNot'),
                variant: 'ghost',
                onPress: () => {
                  setStore((s) => updatePlan(s, planId, (p) => answerDidNot(p, date, todayFn())));
                  toast(t('habitsHub.day.didNotToast'));
                },
              }}
            />
          </View>
        );
      })}
      <Text variant="caption" tone="muted">
        {t('habitsHub.ask.note')}
      </Text>
    </View>
  );
}

/** «عادات اليوم»: banded by the time of day, the occasion line first, then the private check-in, then off days. */
function HabitsGroup({ today, model }: { today: LocalDate; model: TodayModel }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const heart = usePracticeStore((s) => s.heart);
  const planDays = usePlanDays();
  const { actions } = model;
  const [fixing, setFixing] = useState<string | null>(null);
  const [offOpen, setOffOpen] = useState(false);
  const fixPlan = store.plans.find((p) => p.id === fixing);

  const mendFor = useMemo(() => {
    const out = new Map<string, boolean>();
    // C-01j: a missed day is asked first («هل فعلتها؟»); «صلّحها» shows only once no day of the habit waits for an answer.
    const asking = new Set(pendingAsks(store, today, { ...planDays, isPeriodicAct: (p) => habitFor(p, habits)?.kind === 'periodic' }).map((a) => a.planId));
    for (const plan of store.plans) {
      if (asking.has(plan.id)) {
        out.set(plan.id, false);
        continue;
      }
      const state = mendState({
        offer: makeUpOffer(store, plan, today, { ...planDays, heart }),
        missedYesterday: missedDayBefore(store, plan, today, planDays),
        doneToday: plan.log[today] ?? 0,
        paused: isPaused(plan),
      });
      out.set(plan.id, showsMend(state));
    }
    return out;
  }, [store, today, planDays, heart, habits]);

  const addOne = useCallback(
    (item: HabitItem) => setStore((s) => updatePlan(s, item.planId, (p) => logForDay(p, today, 1, todayFn()))),
    [setStore, today],
  );

  const habitRows = model.habitRows.filter((r): r is Extract<AgendaRowModel, { kind: 'habit' }> => r.kind === 'habit');
  const occasions = model.habitRows.filter((r): r is Extract<AgendaRowModel, { kind: 'occasion' }> => r.kind === 'occasion');
  const program = model.habitRows.find((r): r is Extract<AgendaRowModel, { kind: 'program' }> => r.kind === 'program');
  const planOf = (planId: string) => store.plans.find((p) => p.id === planId);
  const bands = byBand(habitRows, (row) => {
    const plan = planOf(row.item.planId);
    return plan ? bandOf(plan) : 'during';
  });
  const undoFor = (planId: string) =>
    actions.lastLog && actions.lastLog.kind === 'habit' && actions.lastLog.planId === planId && actions.lastLog.date === today
      ? actions.lastLog.cleared
        ? ('cleared' as const)
        : ('logged' as const)
      : null;

  const renderHabit = (row: Extract<AgendaRowModel, { kind: 'habit' }>, last: boolean) => {
    const plan = planOf(row.item.planId);
    return (
      <TodayHabitRow
        key={row.key}
        item={row.item}
        unit={plan?.unit ?? 'times'}
        title={row.title}
        meta={row.meta}
        canLog
        last={last}
        undo={undoFor(row.item.planId)}
        onToggle={actions.toggleHabit}
        onAddOne={addOne}
        onUndo={actions.undo}
        onMinimum={row.canMinimum ? actions.logMinimum : undefined}
        onFix={mendFor.get(row.item.planId) ? (item) => setFixing(item.planId) : undefined}
      />
    );
  };

  return (
    <View style={styles.tight}>
      <PendingAsks today={today} />
      {occasions.map((o) => (
        <OccasionRow key={o.key} title={o.title} deed={o.deed} />
      ))}
      {habitRows.length === 0 && !program ? (
        <View style={styles.tight}>
          <Text variant="body" tone="muted">
            {store.plans.length === 0 ? t('habitsHub.today.noHabits') : t('practice.wird.empty')}
          </Text>
          {store.plans.length === 0 ? <Button label={t('practice.addHabit')} icon={Plus} variant="outline" onPress={() => router.push('/practice/add')} /> : null}
        </View>
      ) : null}
      {bands.map(({ band, items }) => (
        <View key={band} style={styles.band}>
          <Text variant="small" tone="muted" style={styles.bandTitle}>
            {t(`habitsHub.today.bands.${band}`)}
          </Text>
          {items.map((row, i) => renderHabit(row, i === items.length - 1))}
        </View>
      ))}
      {program ? <ProgramRow done={program.done} meta={program.meta} /> : null}
      {model.offDayRows.length > 0 ? (
        <View>
          <Pressable
            onPress={() => setOffOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: offOpen }}
            style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
          >
            <Text variant="small" weight="medium" tone="muted" style={styles.toggleText}>
              {t('practice.wird.notDueToday', { count: model.offDayRows.length })}
            </Text>
            <Icon icon={offOpen ? ChevronUp : ChevronDown} size={18} tone="muted" />
          </Pressable>
          {offOpen
            ? model.offDayRows
                .filter((r): r is Extract<AgendaRowModel, { kind: 'habit' }> => r.kind === 'habit')
                .map((row, i, all) => renderHabit(row, i === all.length - 1))
            : null}
        </View>
      ) : null}
      {store.plans.length > 0 ? (
        <>
          <Cheer at={actions.cheerAt} />
          <DayDoneCard today={today} />
        </>
      ) : null}
      <HabitFixSheet
        visible={fixPlan !== undefined}
        onClose={() => setFixing(null)}
        plan={fixPlan}
        habit={fixPlan ? habitFor(fixPlan, habits) : undefined}
        title={fixPlan ? planTitleOf(fixPlan, habits, locale) : ''}
        today={today}
      />
    </View>
  );
}

/** «الفرائض»: the five prayers when tracked (or the switch to track them), then «قضاء الفوائت». */
function FardGroup({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const progress = qadaProgress(store, today);
  return (
    <View style={styles.groups}>
      {fardEnabled(store) ? (
        <FardSection today={today} />
      ) : (
        <View style={styles.tight}>
          <Text variant="body" tone="muted">
            {t('habitsHub.fard.offLine')}
          </Text>
          <Button
            label={t('habitsHub.fard.on')}
            variant="outline"
            onPress={() => {
              setStore((s) => setFardTracking(s, true));
              toast(t('habitsTab.add.fardToast'));
            }}
          />
        </View>
      )}
      <SectionDivider />
      {progress ? (
        <Pressable onPress={() => router.push('/practice/qada')} accessibilityRole="button" style={({ pressed }) => [styles.qada, pressed && styles.togglePressed]}>
          <QadaRing done={progress.doneTotal} owed={progress.owedTotal} size={64} label={t('habitsHub.qada.ringLabel', { done: progress.doneTotal, owed: progress.owedTotal })} />
          <View style={styles.qadaText}>
            <Text variant="body" weight="medium">
              {t('habitsHub.qada.title')}
            </Text>
            <Text variant="small" tone="muted">
              {t('habitsHub.qada.todayLine', { done: progress.today, pace: progress.perDay })}
            </Text>
          </View>
          <ForwardArrow size={16} tone="muted" />
        </Pressable>
      ) : (
        <ListRow icon={Repeat} title={t('habitsHub.qada.title')} hint={t('habitsHub.qada.entryHint')} chevron last onPress={() => router.push('/practice/qada')} />
      )}
    </View>
  );
}

/** «الأعمال الدورية» due today or overdue, loggable; the whole list is in its tab. */
function PeriodicGroup({ today, model }: { today: LocalDate; model: TodayModel }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { actions } = model;
  return (
    <View style={styles.tight}>
      {model.periodicRows.length > 0 ? (
        <TodayList
          date={today}
          today={today}
          rows={model.periodicRows}
          offDayRows={[]}
          canLog
          lastLog={actions.lastLog}
          onToggleHabit={actions.toggleHabit}
          onToggleRelative={actions.toggleRelative}
          onUndo={actions.undo}
        />
      ) : (
        <Text variant="body" tone="muted">
          {t('habitsHub.today.noPeriodic')}
        </Text>
      )}
      <Button label={t('habitsHub.today.allPeriodic')} variant="ghost" size="sm" arrow onPress={() => router.setParams({ tab: 'periodic' })} />
    </View>
  );
}

/** «المزيد لليوم»: one collapsed row with «شعبة الأسبوع» (when shown on home) and «حصيلتي». */
function MoreForToday({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const homeSections = usePracticeStore((s) => s.store.settings.homeSections);
  const weekBranch = resolveHomeSections(homeSections).some((s) => s.key === 'week-branch' && s.visible);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <Text variant="body" weight="medium" style={styles.toggleText}>
          {t('habitsTab.wird.moreToday')}
        </Text>
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} tone="muted" />
      </Pressable>
      {open ? (
        <View style={styles.more}>
          {weekBranch ? <WeekBranchCard today={today} /> : null}
          <TallySection today={today} />
        </View>
      ) : null}
    </View>
  );
}

/** «صحبتك: n حضروا اليوم» (F-16): members of a circle only; opens the circle. */
function CirclesLine({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const circles = useMyCircles();
  const first = circles.data?.[0];
  const detail = useCircle(first?.id ?? '', today);
  if (!first || !detail.data) return null;
  const present = detail.data.members.filter((m) => m.presentDays.includes(today)).length;
  const label = t('habitsTab.wird.circles', { count: present });
  return (
    <Pressable
      onPress={() => router.push(`/circles/${first.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${label}. ${first.name}`}
      style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
    >
      <Icon icon={Users} size={18} tone="link" />
      <Text variant="small" weight="medium" style={styles.toggleText}>
        {label}
      </Text>
      <ForwardArrow size={16} tone="muted" />
    </Pressable>
  );
}
