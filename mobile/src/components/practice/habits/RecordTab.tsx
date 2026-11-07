/**
 * «عاداتي › سجلّي» (owner round 5, §1 IA; F-17, A-22 a, A-28 a): the record, each part a short section divided by the
 * flower divider:
 * - the streak in one row, then the month calendar with the presence marks and the non-weekly occasions marked (a
 *   tapped day opens its list, loggable for the last 7 days); the weekly occasions in ONE row under it («كل اثنين
 *   وخميس», «كل جمعة»), each opening its good deed; the Hijri adjustment (±2 days) behind the calendar icon;
 * - every habit (the paused ones too) as one row opening its page, with the graduation offer;
 * - «نسبة الالتزام» per habit;
 * - «الفرائض» counts, when switched on;
 * - the user's «تخفَّف» programs by the sin's name (A-22 a: a screen inside the app; notifications stay generic);
 * - «حصيلتي».
 * The «مواسم الخير» page is gone (F-17): the calendar subscription moves to «التنبيهات».
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalendarCog, DoorOpen, Pause, Sparkles, Sprout, TreeDeciduous } from 'lucide-react-native';
import {
  activePrograms,
  establishPlan,
  FARD_LABELS,
  fardEnabled,
  fardStats,
  formatHijriAr,
  graduationReady,
  isEstablished,
  isHijriSupported,
  isPaused,
  toHijri,
  updatePlan,
  updateSettings,
  type LocalDate,
  type Plan,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useSins } from '@/lib/api/sins';
import { pick } from '@/lib/practice/catalog-types';
import { monthEnd, shortDayTitle } from '@/lib/practice/calendar-grid';
import { shortDate } from '@/lib/practice/format';
import { splitOccasions, weeklyLabel } from '@/lib/practice/habits-view';
import { canLogOn, occasionDates } from '@/lib/practice/hub';
import { programRows } from '@/lib/practice/my-habits';
import { planView } from '@/lib/practice/plan-view';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
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
import { ProgramActionRow } from '@/components/practice/MyHabitsRows';
import { RamadanBlock } from '@/components/practice/RamadanBlock';
import { CommitmentChart } from '@/components/practice/hub/CommitmentChart';
import { ExcuseChip } from '@/components/practice/hub/ExcuseChip';
import { TallySection } from '@/components/practice/hub/KnowledgeCards';
import { PresenceMonth } from '@/components/practice/hub/PresenceMonth';
import { StreakFlame } from '@/components/practice/hub/StreakFlame';
import { TodayList } from '@/components/practice/hub/TodayList';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, Chip, Icon, IconButton, ListRow, Notice, Section, SectionDivider, SectionHeader, Text, Wrap, toast } from '@/ui';

const OFFSETS = [-2, -1, 0, 1, 2];

const makeStyles = (t: Theme) => ({
  root: { gap: space['2xl'] },
  streakRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  streakNumber: { fontVariant: ['tabular-nums' as const] },
  streakLabel: { flex: 1 },
  calendar: { gap: space.md },
  weekly: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  weeklyItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.xs,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  pressed: { backgroundColor: t.colors.muted },
  group: { gap: space.sm },
  stats: { gap: space.xs },
});

/** «+1» stays «+1» inside Arabic text (an LTR isolate keeps the sign before the digit). */
function signed(n: number): string {
  return n > 0 ? `⁦+${n}⁩` : n < 0 ? `⁦${n}⁩` : '0';
}

export function RecordTab() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const hijriOffset = store.settings.hijriOffset;
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const catalog = usePracticeCatalog(locale);
  const { today, month, first, shiftMonth } = useHubDays();
  const streak = useStreak(today);
  const summary = useMonthPresence(today);
  const marks = usePresenceMarks(month, monthEnd(month), today);
  const split = useMemo(() => splitOccasions(catalog.data?.occasions ?? []), [catalog.data?.occasions]);
  const occasions = useMemo(() => occasionDates(split.other, month, monthEnd(month), hijriOffset), [split.other, month, hijriOffset]);
  const [picked, setPicked] = useState<LocalDate | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const handleSelect = useCallback((date: LocalDate) => setPicked((p) => (p === date ? null : date)), []);
  const hijri = isHijriSupported();
  let todayHijri: string | null = null;
  if (hijri) {
    try {
      const h = toHijri(today, hijriOffset);
      todayHijri = locale === 'ar' ? formatHijriAr(today, hijriOffset) : `${h.day} ${t(`calendar.hijriMonths.${h.month}`)} ${h.year} ${t('calendar.hijriSuffix')}`;
    } catch {
      todayHijri = null;
    }
  }

  return (
    <View style={styles.root}>
      {streak.hasPlans ? (
        streak.display.kind === 'fresh' ? (
          <View style={styles.streakRow}>
            <StreakFlame size={24} />
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
        )
      ) : null}

      <View style={styles.calendar}>
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
        {split.weekly.length > 0 ? (
          <View style={styles.weekly}>
            {split.weekly.map((o) => {
              const days = o.rule.kind === 'weekdays' ? o.rule.days : [0, 1, 2, 3, 4, 5, 6];
              const label = weeklyLabel(days, locale, (d) => t(`practice.weekdays.${d}`));
              return (
                <Pressable
                  key={o.key}
                  onPress={() => router.push(`/good-deeds/${o.deed}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`${label}: ${pick(o, 'title', locale)}`}
                  style={({ pressed }) => [styles.weeklyItem, pressed && styles.pressed]}
                >
                  <Icon icon={Sparkles} size={14} tone="link" />
                  <Text variant="small" weight="medium">
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {hijri ? (
          <View style={styles.streakRow}>
            <Text variant="small" tone="muted" style={styles.streakLabel}>
              {todayHijri ? t('calendar.todayHijri', { date: todayHijri }) : ''}
            </Text>
            <IconButton icon={CalendarCog} label={t('calendar.offset')} onPress={() => setAdjusting(true)} bordered />
          </View>
        ) : null}
      </View>

      {picked ? <PickedDay date={picked} today={today} title={picked === today ? t('practice.today') : shortDayTitle(picked, names)} /> : null}

      <SectionDivider />
      <HabitsList today={today} />
      <RamadanBlock />
      <SectionDivider />
      <CommitmentChart today={today} />

      {fardEnabled(store) ? (
        <>
          <SectionDivider />
          <FardStatsSection today={today} />
        </>
      ) : null}

      <ProgramsSection today={today} />

      <SectionDivider />
      <TallySection today={today} />

      <BottomSheet visible={adjusting} title={t('calendar.offset')} onClose={() => setAdjusting(false)}>
        <Wrap>
          {OFFSETS.map((v) => (
            <Chip
              key={v}
              label={signed(v)}
              selected={hijriOffset === v}
              onPress={() => {
                setStore((s) => updateSettings(s, { hijriOffset: v }));
                toast(t('habitsTab.record.offsetSaved'));
              }}
            />
          ))}
        </Wrap>
        <Text variant="small" tone="muted">
          {t('calendar.offsetHint')}
        </Text>
        {todayHijri ? (
          <Text variant="body" tone="link">
            {t('calendar.todayHijri', { date: todayHijri })}
          </Text>
        ) : null}
        <Button label={t('common.done')} onPress={() => setAdjusting(false)} size="lg" />
      </BottomSheet>
    </View>
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

/** Every habit (periodic acts are in «الدورية»), the paused ones last; each row opens its page. */
function HabitsList({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const plans = usePracticeStore((s) => s.store.plans);
  const setStore = usePracticeStore((s) => s.setStore);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const mine = plans.filter((p) => habitFor(p, habits)?.kind !== 'periodic');
  const ordered = [...mine.filter((p) => !isPaused(p)), ...mine.filter(isPaused)];
  const titleOf = (plan: Plan) => {
    const habit = habitFor(plan, habits);
    return habit ? pick(habit, 'title', locale) : plan.title;
  };
  const ready = mine.filter((plan) => graduationReady(plan, today));
  return (
    <Section title={t('habitsTab.record.habitsTitle')}>
      {ready.map((plan) => (
        <View key={plan.id} style={styles.group}>
          <Notice tone="muted">{`${titleOf(plan)} · ${t('practice.graduation.offer')}`}</Notice>
          <Button
            label={t('practice.graduation.action')}
            variant="outline"
            onPress={() => {
              setStore((s) => updatePlan(s, plan.id, (p) => establishPlan(p, today)));
              toast(t('habitsTab.record.establishedToast'));
            }}
          />
        </View>
      ))}
      {ordered.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('practice.noPlans')}
        </Text>
      ) : (
        <View>
          {ordered.map((plan, i) => {
            const paused = isPaused(plan);
            const view = planView(plan, today);
            const hint = paused
              ? t('practice.paused.since', { date: plan.pausedOn ? shortDate(plan.pausedOn) : '' })
              : t('practice.monthDays', { done: String(view.daysDone), count: view.targetDays });
            return (
              <ListRow
                key={plan.id}
                icon={paused ? Pause : isEstablished(plan) ? TreeDeciduous : Sprout}
                title={titleOf(plan)}
                hint={hint}
                last={i === ordered.length - 1}
                onPress={() => router.push(`/practice/plan/${plan.id}`)}
              />
            );
          })}
        </View>
      )}
    </Section>
  );
}

/** «الفرائض» in numbers over the last 30 days: counts only, no streak and no «missed» percentage. */
function FardStatsSection({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const stats = fardStats(store, today);
  return (
    <View style={styles.group}>
      <SectionHeader title={FARD_LABELS[locale].title} lead={t('habitsTab.record.fardLead', { days: stats.days })} />
      <View style={styles.stats}>
        <Text variant="body">{t('habitsTab.record.fardOnTime', { count: stats.onTime })}</Text>
        <Text variant="body">{t('habitsTab.record.fardQada', { count: stats.qada })}</Text>
        <Text variant="body">{t('habitsTab.record.fardFullDays', { count: stats.allOnTimeDays })}</Text>
      </View>
    </View>
  );
}

/** The running «تخفَّف» programs by the sin's name (A-22 a), each opening the locked program screen. */
function ProgramsSection({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const programs = usePracticeStore((s) => s.store.programs);
  const stages = usePracticeCatalog(locale).data?.sinPrograms.common.stages;
  const rows = useMemo(() => programRows(activePrograms(programs), today), [programs, today]);
  const sins = useSins({ limit: 100 });
  if (rows.length === 0) return null;
  const sinName = (slug: string) => {
    const s = sins.data?.find((x) => x.slug === slug);
    if (!s) return t('sinProgram.unnamed');
    return locale === 'en' ? s.name || s.nameAr : s.nameAr || s.name;
  };
  return (
    <>
      <SectionDivider />
      <Section title={t('more.items.leave-sin')}>
        <View>
          {rows.map((model) => {
            const content = stages?.[model.stageKey];
            return (
              <ProgramActionRow
                key={model.key}
                icon={DoorOpen}
                model={model}
                title={sinName(model.sinSlug)}
                stageTitle={content ? pick(content, 'title', locale) : undefined}
                onOpen={() => router.push('/practice/sin-program')}
              />
            );
          })}
        </View>
      </Section>
    </>
  );
}
