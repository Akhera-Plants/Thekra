/**
 * «المعرفة والقلب» on the app (redesign §4.5), mirroring the website's KnowledgeCards and HabitCards: «حصيلتي» with its
 * gratitude line and «والقبول من الله», the brief «تقبّل الله منك» after a tick, «تمّ وردك اليوم» with one reward text,
 * the stories at moments (by Quote id only; hidden while an id is not filled), «شعبة الأسبوع» / «اسم الأسبوع», and the educational
 * cards («حلقة العادة», how a sin grows, «الاستمرار: ثلاث حقائق»). Rules are practice-core; texts come from the API.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  branchesInPractice,
  branchOfWeek,
  CONSISTENCY_FACTS,
  dayCompletion,
  gratitudeAyah,
  HABIT_LOOP_STEPS,
  nameOfWeekIndex,
  SIN_STEPS,
  storyQuoteId,
  tallies,
  weekCardKind,
  type LocalDate,
  type StoryMoment,
} from '@thekra/practice-core';
import { useBranch } from '@/lib/api/branches';
import { useNamesOfAllah } from '@/lib/api/names';
import { useEvidence, usePracticeCatalog } from '@/lib/api/practice';
import { useAyah } from '@/lib/api/quran';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor } from '@/lib/practice/reminders';
import { usePlanDays } from '@/lib/practice/use-habits-hub';
import { dayDoneLineKey } from '@/lib/practice/day-done';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { QuoteCard } from '@/components/QuoteCard';
import { radius, space, useStyles, type Theme } from '@/theme';
import { ListRow, Text, TextLink } from '@/ui';
import { Sparkles } from 'lucide-react-native';
import { planTitleOf } from './HeartCards';

/** How long «تقبّل الله منك» stays after a tick. */
export const CHEER_MS = 2500;

const makeStyles = (t: Theme) => ({
  section: { gap: space.md },
  rows: { borderTopWidth: 1, borderTopColor: t.colors.border },
  row: { gap: 2, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  steps: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: space.xs },
  done: { gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: t.colors.accent },
});

// ── «حصيلتي» ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * «حصيلتي» in «سجلّي»: each habit's total this month and since the start in its unit (practice-core `formatPlanAmount`
 * with correct Arabic plurals), «أنت تعمل على N شعب» when the habits' deeds map to branches, one rotating line (Quran
 * 16:53 / 49:17 by ayah) and «والقبول من الله». «تخفَّف» days stay inside its locked page.
 */
export function TallySection({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const catalog = usePracticeCatalog(locale);
  const habits = catalog.data?.habits ?? [];
  const rows = useMemo(() => tallies(store, today), [store, today]);
  const branches = useMemo(() => branchesInPractice(store.plans, catalog.data?.deedBranches ?? {}), [store.plans, catalog.data]);
  const unitFallback = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };
  return (
    <View style={styles.section}>
      <Text variant="title" accessibilityRole="header">
        {t('practice.tally.title')}
      </Text>
      {rows.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('practice.tally.empty')}
        </Text>
      ) : (
        <>
          <Text variant="small" tone="muted">
            {t('practice.tally.lead')}
          </Text>
          <View style={styles.rows}>
            {rows.map((row) => {
              const plan = store.plans.find((p) => p.id === row.planId);
              if (!plan) return null;
              const habit = habitFor(plan, habits);
              const amount = (n: number) => formatAmount(n, plan.unit, habit, locale, unitFallback);
              return (
                <View key={row.planId} style={styles.row}>
                  <Text variant="body" weight="medium">
                    {planTitleOf(plan, habits, locale)}
                  </Text>
                  <Text variant="small" tone="muted">
                    {`${t('practice.tally.month', { amount: amount(row.month) })} · ${t('practice.tally.total', { amount: amount(row.total) })}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
      {branches.length > 0 ? <Text variant="body">{t('practice.tally.branches', { count: branches.length })}</Text> : null}
      <GratitudeLine today={today} />
      <Text variant="body" tone="link">
        {t('practice.tally.acceptance')}
      </Text>
    </View>
  );
}

/** Quran 16:53 or 49:17 by day, the stored text only; hidden while it cannot be read. */
function GratitudeLine({ today }: { today: LocalDate }) {
  const locale = useUiLocale();
  const { surah, ayah } = gratitudeAyah(today);
  const verse = useAyah(surah, ayah, locale);
  if (!verse.data) return null;
  const id = verse.data.id;
  return (
    <Pressable onPress={() => router.push(`/quotes/${id}`)} accessibilityRole="link">
      <Text variant="reading" tone="muted">
        {verse.data.textAr}
      </Text>
    </Pressable>
  );
}

// ── Celebration ─────────────────────────────────────────────────────────────────────────────────────────────

/** «تقبّل الله منك» for a moment after a tick (`at` changes on each tick); announced once, faded unless reduce motion. */
export function Cheer({ at }: { at: number | null }) {
  const { t } = useTranslation();
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  const opacity = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    if (at === null) return;
    const message = t('practice.celebrate.accepted');
    AccessibilityInfo.announceForAccessibility(message);
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        opacity.setValue(1);
        return;
      }
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
    const timer = setTimeout(() => setExpiredAt(at), CHEER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [at, opacity, t]);
  if (at === null || expiredAt === at) return null;
  return (
    <Animated.View style={{ opacity }}>
      <Text variant="body" tone="link">
        {t('practice.celebrate.accepted')}
      </Text>
    </Animated.View>
  );
}

/**
 * «تمّ وردك اليوم» (owner round 3, item 4): once every habit asked today has something logged, one short achievement
 * line from a rotating list (a new one each day), plain UI words: no attributed text here.
 */
export function DayDoneCard({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const store = usePracticeStore((s) => s.store);
  const planDays = usePlanDays();
  const { complete } = useMemo(() => dayCompletion(store, today, planDays), [store, today, planDays]);
  if (!complete) return null;
  return (
    <View style={styles.done} accessibilityLiveRegion="polite">
      <Text variant="heading">{t('practice.celebrate.dayDone')}</Text>
      <Text variant="body" tone="link">
        {t(dayDoneLineKey(today))}
      </Text>
    </View>
  );
}

// ── Stories at moments ──────────────────────────────────────────────────────────────────────────────────────

/** A story by Quote id at its moment (heart-texts.yaml through the catalog); nothing while the id is not filled. */
export function StoryLine({ moment }: { moment: StoryMoment }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const catalog = usePracticeCatalog(locale);
  const id = storyQuoteId(moment, catalog.data?.stories);
  const evidence = useEvidence(id ? [id] : [], locale);
  const quote = id ? evidence.data?.get(id) : undefined;
  if (!quote) return null;
  return (
    <View style={styles.section}>
      <Text variant="small" weight="medium" tone="muted">
        {t(`practice.story.${moment}`)}
      </Text>
      <QuoteCard quote={quote} shareable={false} />
    </View>
  );
}

// ── «شعبة الأسبوع» / «اسم الأسبوع» ──────────────────────────────────────────────────────────────────────────

/** «ورد اليوم»'s weekly card (redesign §4.7): even ISO weeks «شعبة الأسبوع», odd weeks «اسم الأسبوع» (practice-core). */
const SHOW_NAME_WEEKS = false;

export function WeekCard({ today }: { today: LocalDate }) {
  // Only for a member who chose to study the branches of faith (owner round 3, item 7: Settings ← «اللغة والمظهر»).
  const optedIn = usePracticeStore((s) => s.prefs.weekBranch);
  if (!optedIn) return null;
  // «اسم الأسبوع» waits while «الأسماء الحسنى» is hidden (owner, 2026-11-01); set SHOW_NAME_WEEKS to true to bring it back.
  return !SHOW_NAME_WEEKS || weekCardKind(today) === 'branch' ? <WeekBranchCard today={today} /> : <WeekNameCard today={today} />;
}

/** «اسم الأسبوع»: one Name of Allah for everyone this name week, walking the API list in turn; opens its page. */
export function WeekNameCard({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const names = useNamesOfAllah();
  const list = names.data ?? [];
  const name = list.length > 0 ? list[nameOfWeekIndex(today, list.length)] : undefined;
  if (!name) return null;
  return (
    <View style={styles.section}>
      <Text variant="small" weight="medium" tone="muted" accessibilityRole="header">
        {t('practice.weekName.title')}
      </Text>
      <TextLink label={name.nameAr} onPress={() => router.push(`/names/${name.slug}`)} />
    </View>
  );
}

/** «شعبة الأسبوع» on «ورد اليوم»: one branch for everyone this ISO week, opening its page; a long title wraps in the card. */
export function WeekBranchCard({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const number = branchOfWeek(today);
  const branch = useBranch(number);
  const title = branch.data ? (locale === 'en' ? branch.data.title : branch.data.titleAr) : null;
  if (!title) return null;
  return (
    <View style={styles.section}>
      <Text variant="small" weight="medium" tone="muted" accessibilityRole="header">
        {`${t('practice.weekBranch.title')} · ${number}`}
      </Text>
      <ListRow icon={Sparkles} title={title} chevron onPress={() => router.push(`/branches/${number}`)} />
    </View>
  );
}

// ── Educational cards ───────────────────────────────────────────────────────────────────────────────────────

function Steps({ steps }: { steps: string[] }) {
  const styles = useStyles(makeStyles);
  // The arrow points the way the line reads.
  const arrow = useUiLocale() === 'en' ? '→' : '←';
  return (
    <View style={styles.steps}>
      {steps.map((step, index) => (
        <Text key={step} variant="body">
          {index > 0 ? `${arrow} ${step}` : step}
        </Text>
      ))}
    </View>
  );
}

/** «حلقة العادة»: تنبيه → نية → عمل صغير → قبول وفرح → تكرار. */
export function HabitLoopCard() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text variant="heading" accessibilityRole="header">
        {t('practice.cards.loopTitle')}
      </Text>
      <Steps steps={HABIT_LOOP_STEPS.map((k) => t(`practice.cards.loop.${k}`))} />
      <Text variant="small" tone="muted">
        {t('practice.cards.loopHint')}
      </Text>
    </View>
  );
}

/** How a sin grows; `withSource` adds the line naming «الفوائد» (strategies screen only, never the main screens). */
export function SinStepsCard({ withSource = false }: { withSource?: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text variant="heading" accessibilityRole="header">
        {t('practice.cards.sinTitle')}
      </Text>
      <Steps steps={SIN_STEPS.map((k) => t(`practice.cards.sin.${k}`))} />
      <Text variant="small" tone="muted">
        {t('practice.cards.sinHint')}
      </Text>
      {withSource ? (
        <Text variant="small" tone="muted">
          {t('practice.cards.sinSource')}
        </Text>
      ) : null}
    </View>
  );
}

/** «الاستمرار: ثلاث حقائق». */
export function ConsistencyCard() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text variant="heading" accessibilityRole="header">
        {t('practice.cards.consistencyTitle')}
      </Text>
      {CONSISTENCY_FACTS.map((k) => (
        <Text key={k} variant="body">{`• ${t(`practice.cards.facts.${k}`)}`}</Text>
      ))}
    </View>
  );
}
