/**
 * A past day opened from the week strip or «سجلّي» (owner round 6, C-01j / C-02d / C-27): practice-core `dayDetails`.
 * - The day's state («حال يومي») when it was not a normal day.
 * - Each habit: its state in calm words; a day still in the ask window asks «هل فعلتها؟» (فعلتها / لم أفعل:
 *   `answerDidIt` / `answerDidNot`); the two optional answers and the day note written on the habit page.
 * - «الفرائض» marks and «قضاء الفوائت» made up that day.
 * - A slipped day: the review — the evening review of that day or the weekly review of its week when saved, else an
 *   offer to do the weekly one — and «تعلّم من الخطأ»: the path the habit took (hub-view `slipPath`), what the member
 *   wrote was hard, and his own «if … then». For «تخفّف»: the programs' day only after the device lock
 *   (`useProgramReveal`), firm and kind words (never «سامح نفسك» on a slip).
 * Periodic acts are left out (they are reminders, not commitments).
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LockKeyhole } from 'lucide-react-native';
import {
  answerDidIt,
  answerDidNot,
  countsAsNotDone,
  dayDetails,
  eveningOf,
  fardEnabled,
  FARD_LABELS,
  isCustomPeriodic,
  FARD_PRAYERS,
  programDayDetails,
  updatePlan,
  weeklyOf,
  type DayLogState,
  type LocalDate,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useSins } from '@/lib/api/sins';
import { shortDayTitle } from '@/lib/practice/calendar-grid';
import { reviewWeekOf, slipPath, type SlipPath } from '@/lib/practice/hub-view';
import { today as todayFn, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor } from '@/lib/practice/reminders';
import { useDateNames, usePlanDays } from '@/lib/practice/use-habits-hub';
import { useProgramReveal } from '@/lib/practice/use-program-reveal';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { HeartSheetView, planTitleOf } from '@/components/practice/hub/HeartCards';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ButtonPair, Icon, SectionDivider, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  block: { gap: space.sm },
  row: { gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  rowLast: { borderBottomWidth: 0 },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  title: { flex: 1, minWidth: 0 },
  answers: { borderWidth: 1, borderColor: t.colors.border, borderRadius: radius.card, backgroundColor: t.colors.card, overflow: 'hidden' as const },
  answer: { gap: 2, paddingHorizontal: space.md, paddingVertical: space.sm },
  answerRule: { borderTopWidth: 1, borderTopColor: t.colors.border },
  path: { flexDirection: 'row' as const, gap: 4, flexWrap: 'wrap' as const },
  pathDot: { width: 12, height: 12, borderRadius: radius.full, borderWidth: 1, borderColor: t.colors.border },
  pathKept: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  pathHalf: { borderColor: t.colors.primary, borderWidth: 2 },
  covered: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: t.colors.muted,
  },
});

const STATE_KEY: Partial<Record<DayLogState, string>> = {
  done: 'habitsHub.day.done',
  partial: 'habitsHub.day.partial',
  open: 'habitsHub.day.open',
  ask: 'habitsHub.day.ask',
  notDone: 'habitsHub.day.notDone',
  markedNotDone: 'habitsHub.day.notDone',
  excused: 'habitsHub.day.excused',
  notAsked: 'habitsHub.day.notAsked',
  archived: 'habitsHub.day.archived',
};

/**
 * `planId` (round 7, C4: a day of «آخر 30 يومًا» on the habit page): that habit only — its state, «هل فعلتها؟» and what
 * was written on the day — without the day's other parts.
 */
export function DaySheet({ date, onClose, planId }: { date: LocalDate | null; onClose: () => void; planId?: string }) {
  const { t } = useTranslation();
  const names = useDateNames();
  const [shown, setShown] = useState<LocalDate | null>(date);
  if (date && date !== shown) setShown(date);
  return (
    <BottomSheet visible={date !== null} title={shown ? shortDayTitle(shown, names) : t('habitsHub.day.title')} onClose={onClose}>
      {shown ? <DayBody date={shown} onClose={onClose} planId={planId} /> : null}
    </BottomSheet>
  );
}

function DayBody({ date, onClose, planId }: { date: LocalDate; onClose: () => void; planId?: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const heart = usePracticeStore((s) => s.heart);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const planDays = usePlanDays();
  const d = todayFn();
  const [weekly, setWeekly] = useState(false);
  const details = useMemo(() => dayDetails(store, date, d, planDays), [store, date, d, planDays]);
  const isPeriodic = (planId: string) => {
    const plan = store.plans.find((p) => p.id === planId);
    return !plan || isCustomPeriodic(plan) || habitFor(plan, habits)?.kind === 'periodic';
  };
  const rows = planId ? details.habits.filter((h) => h.planId === planId) : details.habits.filter((h) => !isPeriodic(h.planId));
  const single = planId !== undefined;
  const unitFallback = { minutes: t('practice.units.minutes'), count: t('practice.units.count'), times: t('practice.units.times') };
  const slips = rows
    .filter((h) => !single && countsAsNotDone(h.state))
    .map((h) => {
      const plan = store.plans.find((p) => p.id === h.planId);
      return plan ? slipPath(store, plan, date, d, planDays) : null;
    })
    .filter((p): p is SlipPath => p !== null);
  const weekOf = reviewWeekOf(date, heart.prefs.reviewDay);
  const weeklyReview = weeklyOf(heart, weekOf);
  const evening = eveningOf(heart, date);
  const marks = FARD_PRAYERS.filter((p) => details.fard[p] !== null);

  function didIt(planId: string, title: string) {
    setStore((s) => updatePlan(s, planId, (p) => answerDidIt(s, p, date, d)));
    toast(t('habitsHub.day.didToast', { habit: title }));
  }
  function didNot(planId: string) {
    setStore((s) => updatePlan(s, planId, (p) => answerDidNot(p, date, d)));
    toast(t('habitsHub.day.didNotToast'));
  }

  return (
    <>
      {details.dayState.state !== 'normal' ? (
        <Text variant="small" tone="muted">
          {t('habitsHub.day.state', { state: t(`habitsHub.dayState.states.${details.dayState.state}`) })}
        </Text>
      ) : null}

      {rows.length === 0 ? (
        <Text variant="body" tone="muted">
          {t('habitsHub.day.empty')}
        </Text>
      ) : (
        <View>
          {rows.map((h, i) => {
            const plan = store.plans.find((p) => p.id === h.planId);
            const habit = plan ? habitFor(plan, habits) : undefined;
            const title = plan ? planTitleOf(plan, habits, locale) : h.title;
            const amount = (n: number) => (plan ? formatAmount(n, plan.unit, habit, locale, unitFallback) : String(n));
            const stateWords = t(STATE_KEY[h.state] ?? 'habitsHub.day.notDone', { done: amount(h.done), required: amount(h.required) });
            return (
              <View key={h.planId} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
                <View style={styles.head}>
                  <Text variant="body" weight="medium" style={styles.title} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text variant="small" tone={h.state === 'done' ? 'link' : 'muted'}>
                    {stateWords}
                  </Text>
                </View>
                {h.state === 'ask' ? (
                  <ButtonPair
                    primary={{ label: t('habitsHub.ask.did'), onPress: () => didIt(h.planId, title), variant: 'outline' }}
                    secondary={{ label: t('habitsHub.ask.didNot'), onPress: () => didNot(h.planId), variant: 'ghost' }}
                  />
                ) : null}
                {h.reflection ? (
                  <Answers
                    items={[
                      { label: t('habitsHub.reflect.helped'), text: h.reflection.helped },
                      { label: t('habitsHub.reflect.hard'), text: h.reflection.hard },
                      { label: t('habitsHub.reflect.note'), text: h.reflection.note },
                    ]}
                  />
                ) : single ? (
                  <Text variant="small" tone="muted">
                    {t('habitsHub.day.nothingWritten')}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {!single && fardEnabled(store) && marks.length > 0 ? (
        <Text variant="small">
          {`${FARD_LABELS[locale].title}: ${marks
            .map((p) => `${FARD_LABELS[locale].prayers[p]} ${t(details.fard[p] === 'onTime' ? 'habitsTab.fard.onTime' : 'habitsTab.fard.qada')}`)
            .join(locale === 'ar' ? '، ' : ', ')}`}
        </Text>
      ) : null}
      {!single && details.qada > 0 ? <Text variant="small">{t('habitsHub.day.qada', { count: details.qada })}</Text> : null}

      {slips.length > 0 ? (
        <>
          <SectionDivider />
          <View style={styles.block}>
            <Text variant="heading" accessibilityRole="header">
              {t('habitsHub.learn.title')}
            </Text>
            <Text variant="small" tone="muted">
              {t('habitsHub.learn.lead')}
            </Text>
            {slips.map((path) => (
              <SlipBlock key={path.planId} path={path} title={planTitleOf(store.plans.find((p) => p.id === path.planId)!, habits, locale)} onOpen={onClose} />
            ))}
          </View>
          <View style={styles.block}>
            <Text variant="heading" accessibilityRole="header">
              {t('habitsHub.day.reviewTitle')}
            </Text>
            {evening || weeklyReview ? (
              <Text variant="small">
                {[evening ? t('habitsHub.day.eveningDone') : null, weeklyReview ? t('habitsHub.day.weeklyDone') : null].filter(Boolean).join(' · ')}
              </Text>
            ) : (
              <>
                <Text variant="small" tone="muted">
                  {t('habitsHub.day.reviewOffer')}
                </Text>
                <Button label={t('habitsHub.day.reviewStart')} variant="outline" onPress={() => setWeekly(true)} />
              </>
            )}
            {weeklyReview?.step ? (
              <Text variant="small" tone="muted">
                {t('habitsHub.review.stepLine', {
                  habit: planTitleOf(store.plans.find((p) => p.id === weeklyReview.step?.planId) ?? store.plans[0]!, habits, locale),
                  choice: t(`practice.heart.weekly.${weeklyReview.step.choice}`),
                })}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}

      {single ? null : <ProgramsOfDay date={date} />}

      {/* The week's review once its day has come; inside the running week, today's evening review. */}
      <HeartSheetView sheet={weekly ? (weekOf <= d ? 'weekly' : 'evening') : null} today={d} weekOf={weekOf <= d ? weekOf : null} onClose={() => setWeekly(false)} />
    </>
  );
}

/**
 * What was written on a day (round 7, C4): each answer under its own question, in one quiet bordered card with hairlines
 * between them — the member's words in full, nothing added. Empty answers are left out.
 */
export function Answers({ items }: { items: { label: string; text?: string | null }[] }) {
  const styles = useStyles(makeStyles);
  const shown = items.filter((i): i is { label: string; text: string } => Boolean(i.text));
  if (shown.length === 0) return null;
  return (
    <View style={styles.answers}>
      {shown.map((item, i) => (
        <View key={item.label} style={[styles.answer, i > 0 && styles.answerRule]}>
          <Text variant="caption" tone="muted">
            {item.label}
          </Text>
          <Text variant="body">{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** «تعلّم من الخطأ» for one habit: its week as dots, what was hard, what helped, and the member's own plan. */
function SlipBlock({ path, title, onOpen }: { path: SlipPath; title: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.block}>
      <Text variant="body" weight="medium">
        {title}
      </Text>
      <View style={styles.path} accessibilityRole="image" accessibilityLabel={t('habitsHub.learn.run', { count: path.run })}>
        {path.days.map((day) => (
          <View
            key={day.date}
            style={[styles.pathDot, day.state === 'done' && styles.pathKept, day.state === 'partial' && styles.pathHalf]}
          />
        ))}
      </View>
      <Text variant="small" tone="muted">
        {t('habitsHub.learn.run', { count: path.run })}
      </Text>
      {path.hard.length > 0 ? (
        <Text variant="small">{`${t('habitsHub.reflect.hardShort')}: ${path.hard.map((h) => h.text).join(' · ')}`}</Text>
      ) : (
        <Text variant="small" tone="muted">
          {t('habitsHub.learn.noHard')}
        </Text>
      )}
      {path.helped.length > 0 ? <Text variant="small">{`${t('habitsHub.reflect.helpedShort')}: ${path.helped.map((h) => h.text).join(' · ')}`}</Text> : null}
      {path.ifThen ? <Text variant="small">{`${t('habitsHub.learn.yourPlan')}: ${path.ifThen}`}</Text> : null}
      <Button
        label={t('habitsHub.learn.openHabit')}
        variant="ghost"
        size="sm"
        onPress={() => {
          onOpen();
          router.push({ pathname: '/practice/plan/[id]', params: { id: path.planId, tab: 'return' } });
        }}
      />
    </View>
  );
}

/** «تخفّف» on that day: a covered line until the device lock; then each program's check-in and answers. */
function ProgramsOfDay({ date }: { date: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const programs = usePracticeStore((s) => s.store.programs);
  const { hasPrograms, revealed, reveal } = useProgramReveal();
  const sins = useSins({ limit: 100 });
  if (!hasPrograms) return null;
  const sinName = (slug: string) => {
    const s = sins.data?.find((x) => x.slug === slug);
    if (!s) return t('sinProgram.unnamed');
    return locale === 'en' ? s.name || s.nameAr : s.nameAr || s.name;
  };
  const days = revealed ? programDayDetails(programs, date) : [];
  return (
    <>
      <SectionDivider />
      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('habitsHub.lighten.title')}
        </Text>
        {!revealed ? (
          <View style={styles.covered}>
            <Icon icon={LockKeyhole} size={18} tone="muted" />
            <Text variant="small" tone="muted" style={styles.title}>
              {t('habitsHub.lighten.coveredDay')}
            </Text>
            <Button label={t('habitsHub.lighten.show')} size="sm" variant="outline" onPress={() => void reveal()} />
          </View>
        ) : days.length === 0 ? (
          <Text variant="small" tone="muted">
            {t('habitsHub.lighten.noneThatDay')}
          </Text>
        ) : (
          days.map((p) => (
            <View key={p.sinSlug} style={styles.row}>
              <Text variant="body" weight="medium">
                {sinName(p.sinSlug)}
              </Text>
              <Text variant="small" tone="muted">
                {p.checkIn ? t(`habitsHub.lighten.value.${p.checkIn.value}`) : t('habitsHub.lighten.noCheckIn')}
              </Text>
              {p.checkIn ? (
                <Answers
                  items={[
                    { label: t('habitsHub.reflect.helpedSin'), text: p.checkIn.helped },
                    { label: t('habitsHub.reflect.hardSin'), text: p.checkIn.hard },
                    { label: t('habitsHub.reflect.note'), text: p.checkIn.note },
                  ]}
                />
              ) : null}
              {p.checkIn && p.checkIn.value !== 'held' ? (
                <Text variant="small" tone="muted">
                  {t('habitsHub.lighten.learnLine')}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </>
  );
}
