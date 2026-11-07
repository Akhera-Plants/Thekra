/**
 * «عاداتي › ورد اليوم» (owner round 5, §1 IA), top to bottom:
 * 1. the title row: today's date, the next prayer when prayer times are set (F-27), «حال يومي» beside it and «أضف»;
 * 2. ONE heart card (practice-core `heartSlot`: a line and «ابدأ» that opens a sheet; F-06 / F-35 / A-01);
 * 3. «الفرائض» when switched on (F-05);
 * 4. today's habits: the circle logs, the row opens the habit page, «صلّحها» after a missed day (two in a row: one good
 *    deed, F-08); habits not asked today behind one collapsed row;
 * 5. periodic acts due today or overdue only (F-14; hidden when none);
 * 6. ONE collapsed «المزيد لليوم» (شعبة الأسبوع when shown on the home page, حصيلتي);
 * 7. «رفقتك: n حضروا اليوم» for circle members only (F-16).
 * No verse line at the top (O-06 b). Sections are divided by the flower divider.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Users } from 'lucide-react-native';
import {
  fardEnabled,
  isPaused,
  makeUpOffer,
  missedDayBefore,
  nextPrayer,
  nextPrayerLine,
  resolveHomeSections,
  addDays,
  type HabitItem,
  type LocalDate,
} from '@thekra/practice-core';
import { useCircle, useMyCircles } from '@/lib/api/circles';
import { usePracticeCatalog } from '@/lib/api/practice';
import { safeHijri, shortDayTitle } from '@/lib/practice/calendar-grid';
import { nowTime } from '@/lib/practice/format';
import { mendState, showsMend } from '@/lib/practice/habits-view';
import { currentPrayerLookup } from '@/lib/practice/prayer';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import {
  useAgendaActions,
  useAgendaRows,
  useDateNames,
  useDayAgenda,
  useOffDayHabits,
  usePlanDays,
} from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { HabitFixSheet } from '@/components/practice/HabitFixSheet';
import { AddSheet } from '@/components/practice/hub/AddSheet';
import { DayState } from '@/components/practice/hub/DayState';
import { HeartSlotCard, planTitleOf } from '@/components/practice/hub/HeartCards';
import { Cheer, DayDoneCard, TallySection, WeekBranchCard } from '@/components/practice/hub/KnowledgeCards';
import { TodayList } from '@/components/practice/hub/TodayList';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, ForwardArrow, Icon, Notice, SectionDivider, Text } from '@/ui';
import { FardSection } from './FardSection';
import { useNow } from './use-now';

const makeStyles = (t: Theme) => ({
  root: { gap: space['2xl'] },
  tight: { gap: space.xs },
  head: { gap: 2 },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  title: { flex: 1, minWidth: 0 },
  footer: { gap: space.md, alignItems: 'stretch' as const },
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
  circles: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.xs,
    borderRadius: radius.control,
  },
});

export function WirdTab({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale);
  const habits = catalog.data?.habits;
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const planDays = usePlanDays();
  const isPeriodicPlan = useCallback((planId: string) => {
    const plan = store.plans.find((p) => p.id === planId);
    return plan ? habitFor(plan, habits ?? [])?.kind === 'periodic' : false;
  }, [store.plans, habits]);

  const items = useDayAgenda(today);
  const rows = useAgendaRows(items, today, today);
  const offDayItems = useOffDayHabits(today);
  const offDayRows = useAgendaRows(offDayItems, today, today);
  const actions = useAgendaActions(today);
  // Habits (and the private check-in, the day's occasion) here; relatives and periodic templates in their own section.
  const isPeriodicRow = (row: (typeof rows)[number]) => row.kind === 'relative' || (row.kind === 'habit' && isPeriodicPlan(row.item.planId));
  const habitRows = rows.filter((row) => !isPeriodicRow(row));
  const periodicRows = rows.filter(isPeriodicRow);
  const offDayHabitRows = offDayRows.filter((row) => !isPeriodicRow(row));

  const [adding, setAdding] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const fixPlan = store.plans.find((p) => p.id === fixing);

  const mendFor = useMemo(() => {
    const out = new Map<string, boolean>();
    for (const plan of store.plans) {
      const offer = makeUpOffer(store, plan, today, { ...planDays, heart });
      const state = mendState({
        offer,
        missedYesterday: missedDayBefore(store, plan, today, planDays),
        doneToday: plan.log[today] ?? 0,
        paused: isPaused(plan),
      });
      out.set(plan.id, showsMend(state));
    }
    return out;
  }, [store, today, planDays, heart]);
  const canFix = useCallback((planId: string) => mendFor.get(planId) === true, [mendFor]);
  const handleFix = useCallback((item: HabitItem) => setFixing(item.planId), []);

  return (
    <View style={styles.root}>
      <TitleRow today={today} onAdd={() => setAdding(true)} />
      <HeartSlotCard today={today} />

      {catalog.isError ? (
        <View style={styles.tight}>
          <Notice tone="destructive">{t('practice.catalogError')}</Notice>
          <Button label={t('common.retry')} onPress={() => void catalog.refetch()} variant="ghost" />
        </View>
      ) : null}

      {fardEnabled(store) ? (
        <>
          <FardSection today={today} />
          <SectionDivider />
        </>
      ) : null}

      <TodayList
        title={t('habitsTab.wird.habitsTitle')}
        date={today}
        today={today}
        rows={habitRows}
        offDayRows={offDayHabitRows}
        canLog
        lastLog={actions.lastLog}
        onToggleHabit={actions.toggleHabit}
        onToggleRelative={actions.toggleRelative}
        onUndo={actions.undo}
        onMinimum={actions.logMinimum}
        onAddHabit={() => router.push('/practice/add')}
        canFix={canFix}
        onFix={handleFix}
        footer={
          store.plans.length > 0 ? (
            <View style={styles.footer}>
              <Cheer at={actions.cheerAt} />
              <DayDoneCard today={today} />
            </View>
          ) : null
        }
      />

      {periodicRows.length > 0 ? (
        <>
          <SectionDivider />
          <TodayList
            title={t('habitsTab.wird.periodicTitle')}
            date={today}
            today={today}
            rows={periodicRows}
            offDayRows={[]}
            canLog
            lastLog={actions.lastLog}
            onToggleHabit={actions.toggleHabit}
            onToggleRelative={actions.toggleRelative}
            onUndo={actions.undo}
          />
        </>
      ) : null}

      {store.plans.length > 0 ? <MoreForToday today={today} /> : null}
      <CirclesLine today={today} />

      <HabitFixSheet
        visible={fixPlan !== undefined}
        onClose={() => setFixing(null)}
        plan={fixPlan}
        habit={fixPlan ? habitFor(fixPlan, habits ?? []) : undefined}
        title={fixPlan ? planTitleOf(fixPlan, habits ?? [], locale) : ''}
        today={today}
      />
      <AddSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

/** The date, the next prayer (when a city is set), «حال يومي» and «أضف» on the title's line. */
function TitleRow({ today, onAdd }: { today: LocalDate; onAdd: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const hasCity = usePracticeStore((s) => s.prefs.prayer !== null);
  usePracticeStore((s) => s.prefs.prayerCache); // re-render when new times arrive
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
        <Button label={t('practice.hub.add')} icon={Plus} onPress={onAdd} variant="outline" size="sm" />
      </View>
      {sub ? (
        <Text variant="small" tone="muted">
          {sub}
        </Text>
      ) : null}
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

/** «رفقتك: n حضروا اليوم» (F-16): members of a circle only; opens the circle. */
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
      style={({ pressed }) => [styles.circles, pressed && styles.togglePressed]}
    >
      <Icon icon={Users} size={18} tone="link" />
      <Text variant="small" weight="medium" style={styles.toggleText}>
        {label}
      </Text>
      <ForwardArrow size={16} tone="muted" />
    </Pressable>
  );
}
