/**
 * «عاداتي › سجلّي» (owner round 6, §4; C-02d, C-03d, C-27): three tabs «أسبوع · شهر · حصيلة».
 * - أسبوع: the reference's table — one row per habit (archived ones too, while they have days that week), one column
 *   per day from the review day; a cell is kept, part kept, «لم تتم» (calm), an excused day, or empty when the day was
 *   not one of the habit's days; future days are disabled. A day's head opens that day (`DaySheet`).
 * - شهر: our calendar with the presence marks, the occasions and the Hijri dates (±2 days behind its icon); a tapped
 *   day opens `DaySheet` (states, answers of the two questions, «الفرائض», «قضاء», and on a slip the review and
 *   «تعلّم من الخطأ»).
 * - حصيلة: the streak, each habit's commitment and completion, «الفرائض», «قضاء الفوائت», «تخفّف» (covered until the
 *   device lock), «حصيلتي».
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalendarCog, Check, ChevronLeft, ChevronRight, DoorOpen, LockKeyhole, Minus, Sparkles } from 'lucide-react-native';
import {
  activePrograms,
  addDays,
  dayLogState,
  FARD_LABELS,
  fardEnabled,
  fardStats,
  formatHijriAr,
  habitCompletion,
  isCustomPeriodic,
  isArchived,
  isHijriSupported,
  qadaProgress,
  toHijri,
  updateSettings,
  weekDays,
  weekStart,
  weekday as weekdayOf,
  type DayLogState,
  type LocalDate,
  type Plan,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useSins } from '@/lib/api/sins';
import { pick } from '@/lib/practice/catalog-types';
import { monthEnd, weekRangeTitle } from '@/lib/practice/calendar-grid';
import { splitOccasions, weeklyLabel } from '@/lib/practice/habits-view';
import { occasionDates } from '@/lib/practice/hub';
import { STRIP_WEEKS_BACK } from '@/lib/practice/hub-view';
import { programRows } from '@/lib/practice/my-habits';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useDateNames, useHubDays, useMonthPresence, usePlanDays, usePresenceMarks, useStreak } from '@/lib/practice/use-habits-hub';
import { useProgramReveal } from '@/lib/practice/use-program-reveal';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ProgramActionRow } from '@/components/practice/MyHabitsRows';
import { RamadanBlock } from '@/components/practice/RamadanBlock';
import { CommitmentChart } from '@/components/practice/hub/CommitmentChart';
import { planTitleOf } from '@/components/practice/hub/HeartCards';
import { TallySection } from '@/components/practice/hub/KnowledgeCards';
import { PresenceMonth } from '@/components/practice/hub/PresenceMonth';
import { StreakFlame } from '@/components/practice/hub/StreakFlame';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { BottomSheet, Button, Chip, Icon, IconButton, Section, SectionDivider, SectionHeader, SegmentTabs, Text, Wrap, toast } from '@/ui';
import { DaySheet } from './DaySheet';
import { QadaRing } from './QadaRing';

type Part = 'week' | 'month' | 'total';
const OFFSETS = [-2, -1, 0, 1, 2];
const CELL = 30;

const makeStyles = (t: Theme) => ({
  root: { gap: space['2xl'] },
  section: { gap: space.md },
  streakRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  num: { fontVariant: ['tabular-nums' as const] },
  grow: { flex: 1, minWidth: 0 },
  weekNav: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  table: { borderWidth: 1, borderColor: t.colors.border, borderRadius: radius.card, backgroundColor: t.colors.card, paddingVertical: space.xs },
  tr: { flexDirection: 'row' as const, alignItems: 'center' as const, minHeight: 56, paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  trLast: { borderBottomWidth: 0 },
  name: { width: 104, paddingEnd: space.xs, gap: 0 },
  head: { width: CELL, alignItems: 'center' as const, minHeight: 48, justifyContent: 'center' as const, borderRadius: radius.control },
  headPressed: { backgroundColor: t.colors.accent },
  cellBox: { width: CELL, alignItems: 'center' as const },
  cell: { width: CELL - 4, height: CELL - 4, borderRadius: 7, borderWidth: 1, borderColor: t.colors.border, alignItems: 'center' as const, justifyContent: 'center' as const },
  cellDone: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  cellPartial: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.link },
  cellNot: { backgroundColor: t.colors.muted },
  cellFuture: { opacity: 0.35 },
  legend: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.md },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
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
  habitLine: { gap: 4, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  bar: { height: 4, borderRadius: radius.full, backgroundColor: t.colors.muted, overflow: 'hidden' as const },
  fill: { height: 4, backgroundColor: t.colors.primary },
  qada: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.lg },
  covered: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: t.colors.muted },
});

export function RecordTab() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { today } = useHubDays();
  const [part, setPart] = useState<Part>('week');
  const [openDay, setOpenDay] = useState<LocalDate | null>(null);
  return (
    <View style={styles.root}>
      <SegmentTabs
        items={[
          { key: 'week', label: t('habitsHub.record.week') },
          { key: 'month', label: t('habitsHub.record.month') },
          { key: 'total', label: t('habitsHub.record.total') },
        ]}
        value={part}
        onChange={setPart}
      />
      {part === 'week' ? <WeekPart today={today} onOpenDay={setOpenDay} /> : part === 'month' ? <MonthPart onOpenDay={setOpenDay} /> : <TotalPart today={today} />}
      <DaySheet date={openDay} onClose={() => setOpenDay(null)} />
    </View>
  );
}

// ── أسبوع ──────────────────────────────────────────────────────────────────────────────────────────────────────

function WeekPart({ today, onOpenDay }: { today: LocalDate; onOpenDay: (d: LocalDate) => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const store = usePracticeStore((s) => s.store);
  const reviewDay = usePracticeStore((s) => s.heart.prefs.reviewDay);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const [offset, setOffset] = useState(0);
  const start = addDays(weekStart(today, reviewDay), offset * 7);
  const days = weekDays(start, reviewDay);
  const end = days[6]!;
  const plans = store.plans.filter((p) => !isCustomPeriodic(p) && habitFor(p, habits)?.kind !== 'periodic' && p.createdOn <= end);
  const range = weekRangeTitle(end, names);
  return (
    <View style={styles.section}>
      <View style={styles.weekNav}>
        <IconButton icon={locale === 'ar' ? ChevronRight : ChevronLeft} label={t('habitsHub.week.previous')} onPress={() => setOffset((o) => Math.max(-STRIP_WEEKS_BACK * 6, o - 1))} />
        <View style={styles.grow}>
          <Text variant="heading" align="center">
            {t('habitsHub.record.weekTitle')}
          </Text>
          <Text variant="small" tone="muted" align="center">
            {range}
          </Text>
        </View>
        <IconButton icon={locale === 'ar' ? ChevronLeft : ChevronRight} label={t('habitsHub.week.next')} onPress={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} />
      </View>
      {plans.length === 0 ? (
        <Text variant="body" tone="muted">
          {t('practice.noPlans')}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={[styles.table, { flexGrow: 1 }]}>
            <View style={styles.tr}>
              <Text variant="caption" tone="muted" style={styles.name}>
                {t('habitsHub.record.habit')}
              </Text>
              {days.map((d) => {
                const opens = d <= today;
                return (
                  <Pressable
                    key={d}
                    disabled={!opens}
                    onPress={() => onOpenDay(d)}
                    accessibilityRole="button"
                    accessibilityLabel={`${names.weekday(weekdayOf(d))} ${Number(d.slice(8))}`}
                    // A future day is plain muted text (readable, AA), not faded (web parity).
                    style={({ pressed }) => [styles.head, pressed && opens && styles.headPressed]}
                  >
                    <Text variant="caption" tone={d === today ? 'link' : 'muted'} numberOfLines={1}>
                      {t(`practice.hub.weekdayShort.${weekdayOf(d)}`)}
                    </Text>
                    <Text variant="small" weight={d === today ? 'semibold' : 'regular'} tone={d === today ? 'link' : opens ? 'default' : 'muted'} style={styles.num}>
                      {String(Number(d.slice(8)))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {plans.map((plan, i) => (
              <View key={plan.id} style={[styles.tr, i === plans.length - 1 && styles.trLast]}>
                <View style={styles.name}>
                  <Text variant="small" weight="medium" numberOfLines={2}>
                    {planTitleOf(plan, habits, locale)}
                  </Text>
                  {isArchived(plan) ? (
                    <Text variant="caption" tone="muted">
                      {t('habitsHub.day.archived')}
                    </Text>
                  ) : null}
                </View>
                {days.map((d) => (
                  <View key={d} style={styles.cellBox}>
                    <Cell state={dayLogState(store, plan, d, today, planDays)} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <View style={styles.legend}>
        <Legend state="done" label={t('habitsHub.record.legendDone')} />
        <Legend state="partial" label={t('habitsHub.record.legendPartial')} />
        <Legend state="notDone" label={t('habitsHub.week.notDone')} />
        <Legend state="notAsked" label={t('habitsHub.record.legendEmpty')} />
      </View>
    </View>
  );
}

function Cell({ state }: { state: DayLogState }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const words: Partial<Record<DayLogState, string>> = {
    done: t('habitsHub.record.legendDone'),
    partial: t('habitsHub.record.legendPartial'),
    ask: t('habitsHub.week.notDone'),
    notDone: t('habitsHub.week.notDone'),
    markedNotDone: t('habitsHub.week.notDone'),
    excused: t('habitsHub.week.excused'),
    open: t('practice.today'),
  };
  const notDone = state === 'ask' || state === 'notDone' || state === 'markedNotDone';
  return (
    <View
      accessible
      accessibilityLabel={words[state] ?? t('habitsHub.record.legendEmpty')}
      style={[
        styles.cell,
        state === 'done' && styles.cellDone,
        state === 'partial' && styles.cellPartial,
        notDone && styles.cellNot,
        state === 'excused' && styles.cellNot,
        (state === 'future' || state === 'beforeStart' || state === 'archived' || state === 'notAsked') && styles.cellFuture,
      ]}
    >
      {state === 'done' ? <Icon icon={Check} size={16} tone="inverse" strokeWidth={2.4} /> : null}
      {notDone ? <Icon icon={Minus} size={14} tone="muted" /> : null}
      {state === 'excused' ? (
        <Text variant="caption" tone="muted">
          {t('habitsHub.record.excusedShort')}
        </Text>
      ) : null}
    </View>
  );
}

function Legend({ state, label }: { state: DayLogState; label: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.legendItem}>
      <View style={{ transform: [{ scale: 0.7 }] }}>
        <Cell state={state} />
      </View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

// ── شهر ───────────────────────────────────────────────────────────────────────────────────────────────────────

function MonthPart({ onOpenDay }: { onOpenDay: (d: LocalDate) => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const hijriOffset = store.settings.hijriOffset;
  const showHijri = usePracticeStore((s) => s.prefs.showHijri);
  const catalog = usePracticeCatalog(locale);
  const { today, month, shiftMonth } = useHubDays();
  // The month rows start on the review day too, like the week strip and the week table (round 6 §2; web parity).
  const first = usePracticeStore((s) => s.heart.prefs.reviewDay);
  const summary = useMonthPresence(today);
  const marks = usePresenceMarks(month, monthEnd(month), today);
  const split = useMemo(() => splitOccasions(catalog.data?.occasions ?? []), [catalog.data?.occasions]);
  const occasions = useMemo(() => occasionDates(split.other, month, monthEnd(month), hijriOffset), [split.other, month, hijriOffset]);
  const [adjusting, setAdjusting] = useState(false);
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
    <View style={styles.section}>
      <PresenceMonth
        summary={summary}
        month={month}
        first={first}
        today={today}
        selected={null}
        showHijri={showHijri}
        marks={marks}
        occasions={occasions}
        onSelect={(d) => (d <= today ? onOpenDay(d) : undefined)}
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
          <Text variant="small" tone="muted" style={styles.grow}>
            {todayHijri ? t('calendar.todayHijri', { date: todayHijri }) : ''}
          </Text>
          <IconButton icon={CalendarCog} label={t('calendar.offset')} onPress={() => setAdjusting(true)} bordered />
        </View>
      ) : null}
      <Text variant="caption" tone="muted">
        {t('habitsHub.record.monthHint')}
      </Text>
      <BottomSheet visible={adjusting} title={t('calendar.offset')} onClose={() => setAdjusting(false)}>
        <Wrap>
          {OFFSETS.map((v) => (
            <Chip
              key={v}
              label={v > 0 ? `⁦+${v}⁩` : v < 0 ? `⁦${v}⁩` : '0'}
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
        <Button label={t('common.done')} onPress={() => setAdjusting(false)} size="lg" />
      </BottomSheet>
    </View>
  );
}

// ── حصيلة ──────────────────────────────────────────────────────────────────────────────────────────────────────

function TotalPart({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const streak = useStreak(today);
  const qada = qadaProgress(store, today);
  const mine = store.plans.filter((p) => !isCustomPeriodic(p) && habitFor(p, habits)?.kind !== 'periodic');
  return (
    <>
      {streak.hasPlans ? (
        streak.display.kind === 'fresh' ? (
          <View style={styles.streakRow}>
            <StreakFlame size={24} />
            <Text variant="body">{t('practice.wird.streakFresh', { n: streak.display.longest })}</Text>
          </View>
        ) : (
          <View style={styles.streakRow} accessible accessibilityLabel={`${t('practice.wird.streakLabel', { count: streak.current })}. ${t('record.longest', { count: streak.longest })}`}>
            <StreakFlame size={24} />
            <Text variant="title" style={styles.num}>
              {String(streak.current)}
            </Text>
            <Text variant="body" style={styles.grow} numberOfLines={1}>
              {t('record.current')}
            </Text>
            <Text variant="small" tone="muted">
              {t('record.longestShort', { count: streak.longest })}
            </Text>
          </View>
        )
      ) : null}

      {mine.length > 0 ? (
        <Section title={t('habitsHub.record.completionTitle')}>
          <View>
            {mine.map((plan) => (
              <HabitCompletionLine key={plan.id} plan={plan} title={planTitleOf(plan, habits, locale)} today={today} />
            ))}
          </View>
        </Section>
      ) : null}
      <RamadanBlock />
      <SectionDivider />
      <CommitmentChart today={today} />

      {fardEnabled(store) ? (
        <>
          <SectionDivider />
          <FardStats today={today} />
        </>
      ) : null}

      {qada ? (
        <>
          <SectionDivider />
          <View style={styles.section}>
            <SectionHeader title={t('habitsHub.qada.title')} />
            <Pressable onPress={() => router.push('/practice/qada')} accessibilityRole="button" style={styles.qada}>
              <QadaRing done={qada.doneTotal} owed={qada.owedTotal} size={88} label={t('habitsHub.qada.ringLabel', { done: qada.doneTotal, owed: qada.owedTotal })} />
              <View style={styles.grow}>
                <Text variant="body">{t('habitsHub.qada.doneOf', { done: qada.doneTotal, owed: qada.owedTotal })}</Text>
                <Text variant="small" tone="muted">
                  {qada.remaining === 0 ? t('habitsHub.qada.finished') : t('habitsHub.qada.daysLeft', { count: qada.daysLeft })}
                </Text>
              </View>
            </Pressable>
          </View>
        </>
      ) : null}

      <ProgramsTotal today={today} />

      <SectionDivider />
      <TallySection today={today} />
    </>
  );
}

function HabitCompletionLine({ plan, title, today }: { plan: Plan; title: string; today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const c = habitCompletion(plan, today);
  return (
    <Pressable onPress={() => router.push(`/practice/plan/${plan.id}`)} accessibilityRole="button" style={styles.habitLine}>
      <View style={styles.streakRow}>
        <Text variant="body" style={styles.grow} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="small" tone="muted" style={styles.num}>{`${c.percent}%`}</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${c.percent}%` }]} />
      </View>
      <Text variant="caption" tone="muted">
        {t('habitsHub.record.keptLine', { kept: Math.min(c.keptDays, c.targetDays), target: c.targetDays })}
      </Text>
    </Pressable>
  );
}

function FardStats({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const stats = fardStats(store, today);
  return (
    <View style={styles.section}>
      <SectionHeader title={FARD_LABELS[locale].title} lead={t('habitsTab.record.fardLead', { days: stats.days })} />
      <Text variant="body">{t('habitsTab.record.fardOnTime', { count: stats.onTime })}</Text>
      <Text variant="body">{t('habitsTab.record.fardQada', { count: stats.qada })}</Text>
      <Text variant="body">{t('habitsTab.record.fardFullDays', { count: stats.allOnTimeDays })}</Text>
    </View>
  );
}

/** «تخفّف» in the totals: covered until the device lock, then each program by name with its stage. */
function ProgramsTotal({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const programs = usePracticeStore((s) => s.store.programs);
  const stages = usePracticeCatalog(locale).data?.sinPrograms.common.stages;
  const { hasPrograms, revealed, reveal } = useProgramReveal();
  const { colors } = useTheme();
  const sins = useSins({ limit: 100 });
  const rows = useMemo(() => programRows(activePrograms(programs), today), [programs, today]);
  if (!hasPrograms) return null;
  const sinName = (slug: string) => {
    const s = sins.data?.find((x) => x.slug === slug);
    if (!s) return t('sinProgram.unnamed');
    return locale === 'en' ? s.name || s.nameAr : s.nameAr || s.name;
  };
  return (
    <>
      <SectionDivider />
      <View style={styles.section}>
        <SectionHeader title={t('habitsHub.lighten.title')} />
        {!revealed ? (
          <View style={styles.covered}>
            <Icon icon={LockKeyhole} size={18} color={colors.mutedForeground} />
            <Text variant="small" tone="muted" style={styles.grow}>
              {t('habitsHub.lighten.coveredTotal')}
            </Text>
            <Button label={t('habitsHub.lighten.show')} size="sm" variant="outline" onPress={() => void reveal()} />
          </View>
        ) : (
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
        )}
      </View>
    </>
  );
}
