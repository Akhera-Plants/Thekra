/**
 * «عاداتي › محاسبتي» (owner round 6, §4; C-02c): kind but firm, never «حاسب نفسك الآن».
 * - The line «حاسب نفسك اليوم ليخفّ حسابك غدًا» under the title (our own words; no weak hadith quoted).
 * - «خطوتك القادمة» (the reference): the step chosen in the last weekly review, with its habit; else where to choose it.
 * - Tabs «اليوم / الأسبوع»:
 *   - اليوم: «نية اليوم» (its switch, «ابدأ» in the morning), «محاسبة المساء» (any hour), and «تعلّم من الخطأ»: what the
 *     member wrote was hard on his habits these last days;
 *   - الأسبوع: «ثقيلٌ الآن، خفيفٌ بعد», the weekly review («ابدأ محاسبة الأسبوع» beside its day), «تعلّم من الخطأ» for
 *     the habits that slipped this week, and «وقفات سابقة»: every earlier review, always reachable.
 * «رسائلي إلى نفسي» moved to «العادات» (its own list). Device-local, never synced.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronDown, ChevronUp, ClipboardCheck, Footprints, Moon, Sun } from 'lucide-react-native';
import {
  addDays,
  eveningOf,
  INTENTION_UNTIL,
  intentionOf,
  reviewHistory,
  setHeartPrefs,
  weekSummary,
  weeklyOf,
  type LocalDate,
  type WeeklyReview,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { weekRangeTitle } from '@/lib/practice/calendar-grid';
import { nowTime } from '@/lib/practice/format';
import { lastReviewDay, reviewLines, type HeartSheet } from '@/lib/practice/habits-view';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useDateNames, usePlanDays, useShortDate } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { WeekdayPicker } from '@/components/practice/editors';
import { HabitLines, HeartSheetView, planTitleOf } from '@/components/practice/hub/HeartCards';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, Icon, ListRow, Section, SectionDivider, SegmentTabs, SwitchRow, Text, toast } from '@/ui';

type Part = 'day' | 'week';
/** Earlier reviews shown before «المزيد». */
const PAST_SHOWN = 4;
/** Days «تعلّم من الخطأ» looks back on the «اليوم» tab. */
const RECENT_DAYS = 7;

const makeStyles = (t: Theme) => ({
  root: { gap: space['2xl'] },
  head: { gap: space.xs },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  step: { gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: t.colors.primarySoft },
  review: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  learn: { gap: 2, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  more: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, minHeight: 44, alignSelf: 'flex-start' as const },
});

export function ReviewTab({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const heart = usePracticeStore((s) => s.heart);
  const [part, setPart] = useState<Part>('day');
  const [sheet, setSheet] = useState<HeartSheet | null>(null);
  const weekOf = lastReviewDay(today, heart.prefs.reviewDay);
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          {t('habitsTab.tabs.review')}
        </Text>
        <Text variant="body" tone="muted">
          {t('habitsHub.review.lead')}
        </Text>
      </View>
      <NextStepCard onWeekly={() => {
        setPart('week');
        setSheet('weekly');
      }} />
      <SegmentTabs
        items={[
          { key: 'day', label: t('habitsHub.review.day') },
          { key: 'week', label: t('habitsHub.review.week') },
        ]}
        value={part}
        onChange={setPart}
      />
      {part === 'day' ? <DayPart today={today} onSheet={setSheet} /> : <WeekPart today={today} onSheet={setSheet} />}
      <HeartSheetView sheet={sheet} today={today} weekOf={weekOf} onClose={() => setSheet(null)} />
    </View>
  );
}

/** «خطوتك القادمة»: the step of the latest weekly review, or where to choose one. */
function NextStepCard({ onWeekly }: { onWeekly: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const heart = usePracticeStore((s) => s.heart);
  const plans = usePracticeStore((s) => s.store.plans);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const last = reviewHistory(heart).find((r) => r.step);
  const plan = last?.step ? plans.find((p) => p.id === last.step?.planId) : undefined;
  return (
    <View style={styles.step}>
      <View style={styles.row}>
        <Icon icon={Footprints} size={20} tone="link" />
        <Text variant="heading" style={styles.rowText}>
          {t('habitsHub.review.nextStep')}
        </Text>
      </View>
      {last?.step && plan ? (
        <>
          <Text variant="body">
            {t('habitsHub.review.stepLine', { habit: planTitleOf(plan, habits, locale), choice: t(`practice.heart.weekly.${last.step.choice}`) })}
          </Text>
          <Button label={t('habitsHub.review.openHabit')} variant="outline" size="sm" onPress={() => router.push(`/practice/plan/${plan.id}`)} />
        </>
      ) : (
        <>
          <Text variant="small" tone="muted">
            {t('habitsHub.review.noStep')}
          </Text>
          <Button label={t('habitsHub.review.startWeekly')} variant="outline" size="sm" onPress={onWeekly} />
        </>
      )}
    </View>
  );
}

function DayPart({ today, onSheet }: { today: LocalDate; onSheet: (s: HeartSheet) => void }) {
  const { t } = useTranslation();
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const morning = nowTime() < INTENTION_UNTIL;
  const intention = intentionOf(heart, today);
  const evening = eveningOf(heart, today);
  return (
    <>
      <Section title={t('practice.heart.intention.title')}>
        <SwitchRow
          label={t('habitsTab.review.intentionSwitch')}
          hint={t('practice.onboarding.intentionHint')}
          value={heart.prefs.intention}
          onValueChange={(on) => {
            setHeart((h) => setHeartPrefs(h, { intention: on }));
            toast(t(on ? 'habitsTab.heart.intentionOnToast' : 'habitsTab.review.intentionOffToast'));
          }}
        />
        {heart.prefs.intention && morning ? (
          <ReviewRow
            icon={Sun}
            title={intention ? t('practice.heart.intention.made') : t('habitsTab.heart.intentionLine')}
            action={t(intention ? 'habitsTab.review.edit' : 'habitsTab.heart.start')}
            onPress={() => onSheet('intention')}
          />
        ) : null}
      </Section>
      <SectionDivider />
      <Section title={t('practice.heart.evening.title')} lead={t('habitsHub.review.eveningLead')}>
        <ReviewRow
          icon={Moon}
          title={evening ? t('habitsTab.review.eveningDone') : t('habitsTab.review.eveningLine')}
          action={t(evening ? 'habitsTab.review.again' : 'habitsHub.review.startEvening')}
          onPress={() => onSheet('evening')}
        />
      </Section>
      <SectionDivider />
      <LearnFromRecent from={addDays(today, -(RECENT_DAYS - 1))} to={today} />
    </>
  );
}

function WeekPart({ today, onSheet }: { today: LocalDate; onSheet: (s: HeartSheet) => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const names = useDateNames();
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const store = usePracticeStore((s) => s.store);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const [pickingDay, setPickingDay] = useState(false);
  const [allPast, setAllPast] = useState(false);
  const reviews = reviewHistory(heart);
  const weekOf = lastReviewDay(today, heart.prefs.reviewDay);
  const thisWeek = weeklyOf(heart, weekOf);
  const dayName = t(`practice.weekdays.${heart.prefs.reviewDay}`);
  const summary = useMemo(() => weekSummary(store, weekOf, today, planDays), [store, weekOf, today, planDays]);
  const titleOf = (planId: string, stored: string) => {
    const plan = store.plans.find((p) => p.id === planId);
    return plan ? planTitleOf(plan, habits, locale) : stored;
  };
  const past = allPast ? reviews : reviews.slice(0, PAST_SHOWN);
  return (
    <>
      <Section title={t('habitsTab.review.weeklyTitle')} lead={t('habitsHub.review.weekLead')}>
        <ReviewRow
          icon={ClipboardCheck}
          title={thisWeek ? t('habitsTab.review.weeklyDone', { date: weekRangeTitle(weekOf, names) }) : t('habitsHub.review.weeklyOpen', { day: dayName })}
          action={t(thisWeek ? 'habitsTab.review.again' : 'habitsHub.review.start')}
          onPress={() => onSheet('weekly')}
        />
        <ListRow icon={CalendarDays} title={t('habitsTab.review.dayRow')} value={dayName} chevron last onPress={() => setPickingDay(true)} />
      </Section>

      {summary.weak.length > 0 ? (
        <>
          <SectionDivider />
          <Section title={t('habitsHub.learn.title')} lead={t('habitsHub.learn.weekLead')}>
            <HabitLines lines={summary.weak.map((r) => ({ planId: r.planId, title: titleOf(r.planId, ''), missed: r.missed }))} />
            <LearnFromRecent from={addDays(weekOf, -6)} to={today} bare />
          </Section>
        </>
      ) : null}

      <SectionDivider />
      <Section title={t('habitsHub.review.pastTitle')} lead={reviews.length === 0 ? t('practice.heart.reviews.empty') : undefined}>
        {past.map((review) => (
          <PastReview key={review.weekOf} review={review} titleOf={titleOf} />
        ))}
        {reviews.length > PAST_SHOWN ? (
          <Pressable onPress={() => setAllPast((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: allPast }} style={styles.more}>
            <Text variant="small" weight="medium" tone="link">
              {allPast ? t('habitsTab.review.less') : t('habitsTab.review.more', { count: reviews.length - PAST_SHOWN })}
            </Text>
            <Icon icon={allPast ? ChevronUp : ChevronDown} size={16} tone="link" />
          </Pressable>
        ) : null}
      </Section>

      <BottomSheet visible={pickingDay} title={t('habitsTab.review.pickDay')} onClose={() => setPickingDay(false)}>
        <Text variant="small" tone="muted">
          {t('habitsTab.review.pickDayHint')}
        </Text>
        <WeekdayPicker
          single
          value={[heart.prefs.reviewDay]}
          onChange={(days) => {
            const day = days[0];
            if (day === undefined) return;
            setHeart((h) => setHeartPrefs(h, { reviewDay: day, fridayReview: true }));
            setPickingDay(false);
            toast(t('habitsTab.review.daySaved', { day: t(`practice.weekdays.${day}`) }));
          }}
        />
      </BottomSheet>
    </>
  );
}

function PastReview({ review, titleOf }: { review: WeeklyReview; titleOf: (id: string, stored: string) => string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  return (
    <View style={styles.review}>
      <Text variant="body" weight="medium">
        {t('practice.heart.reviews.weekOf', { date: weekRangeTitle(review.weekOf, names) })}
      </Text>
      <HabitLines lines={reviewLines(review).map((l) => ({ ...l, title: titleOf(l.planId, l.title) }))} />
      {review.step ? (
        <Text variant="small" tone="muted">
          {t('habitsHub.review.stepLine', { habit: titleOf(review.step.planId, ''), choice: t(`practice.heart.weekly.${review.step.choice}`) })}
        </Text>
      ) : null}
      {review.message ? (
        <Text variant="small">{`${t('habitsHub.review.yourLine')}: ${review.message}`}</Text>
      ) : null}
    </View>
  );
}

/** «تعلّم من الخطأ»: what the member wrote was hard on his habits between two days (newest first), each opening its habit. */
function LearnFromRecent({ from, to, bare }: { from: LocalDate; to: LocalDate; bare?: boolean }) {
  const shortDate = useShortDate();
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const items = (store.reflections ?? [])
    .filter((r) => r.hard && r.date >= from && r.date <= to && store.plans.some((p) => p.id === r.planId))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);
  const list =
    items.length === 0 ? (
      <Text variant="small" tone="muted">
        {t('habitsHub.learn.empty')}
      </Text>
    ) : (
      <View>
        {items.map((r) => {
          const plan = store.plans.find((p) => p.id === r.planId)!;
          return (
            <Pressable key={`${r.planId}|${r.date}`} onPress={() => router.push(`/practice/plan/${r.planId}`)} accessibilityRole="button" style={styles.learn}>
              <Text variant="caption" tone="muted">{`${planTitleOf(plan, habits, locale)} · ${shortDate(r.date)}`}</Text>
              <Text variant="body">{r.hard}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  if (bare) return list;
  return (
    <Section title={t('habitsHub.learn.title')} lead={t('habitsHub.learn.dayLead')}>
      {list}
    </Section>
  );
}

/** One line of a review part with its action on the line. */
function ReviewRow({ icon, title, action, onPress }: { icon: typeof Sun; title: string; action: string; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Icon icon={icon} size={20} tone="link" />
      <View style={styles.rowText}>
        <Text variant="body">{title}</Text>
      </View>
      <Button label={action} variant="outline" size="sm" onPress={onPress} />
    </View>
  );
}

