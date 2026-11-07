/**
 * The habit page (owner round 5, F-31 a; A-14 superseded): a summary, not a second place to log. Top to bottom: the
 * name with «عدّل» on its line and one line of its schedule («3 أيام في الأسبوع · بعد الفجر»), the notes that need a
 * decision (paused → «استأنف», ready to settle, a reminder time outside the deed's window), «صلّحها» after a missed day,
 * «آخر 30 يومًا» with «صحّح السجل» on its line, «زد خطوة» when due (and the lighter step after a weak month), the two
 * answers saved from «أضف» (F-13), and «آيات وأحاديث تعينك على هذه الطاعة». Every setting (times, days, the answers)
 * is in ONE «عدّل» sheet; the header «⋯» holds «عدّل», pause or resume, and delete (confirmed there, A-15). Logging
 * happens in «ورد اليوم»; here only «صحّح السجل». Sections are divided by the flower divider; every save toasts.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pause, PencilLine, Play, SearchX, Trash2 } from 'lucide-react-native';
import {
  ANCHOR_LABELS,
  correctLog,
  decreaseTo,
  deletePlan,
  establishPlan,
  graduationReady,
  increase,
  isPaused,
  isPrayerAnchor,
  makeUpOffer,
  missedDayBefore,
  normalize,
  orderedSlots,
  pausePlan,
  resumePlan,
  slotChoices,
  updatePlan,
  type Plan,
} from '@thekra/practice-core';
import { useDisplayTime } from '@/components/practice/editors';
import { fixedChoices, unsuitableChoices, windowRange } from '@/lib/practice/deed-window';
import { currentPrayerDay } from '@/lib/practice/prayer';
import { useEvidence, usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { ruleToWeekdays, shortDate } from '@/lib/practice/format';
import { answersOf, mendState, showsMend } from '@/lib/practice/habits-view';
import { planView } from '@/lib/practice/plan-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor, planRule } from '@/lib/practice/reminders';
import { usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { HabitFixSheet } from '@/components/practice/HabitFixSheet';
import { MonthPanel } from '@/components/practice/PlanHistoryAndSettings';
import { PlanEditSheet } from '@/components/practice/PlanEditSheet';
import { FixPanel } from '@/components/practice/PlanTodayCard';
import { space, useStyles, type Theme } from '@/theme';
import {
  ActionMenu,
  BottomSheet,
  Button,
  ButtonPair,
  EmptyState,
  Loading,
  NextStep,
  PageHeader,
  Screen,
  Section,
  SectionDivider,
  Text,
  Wrap,
  toast,
} from '@/ui';

const makeStyles = (t: Theme) => ({
  offerActions: { marginTop: space.sm },
  answer: { gap: 2, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  answerLast: { borderBottomWidth: 0 },
});

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const store = usePracticeStore((s) => s.store);
  const heart = usePracticeStore((s) => s.heart);
  const plan = store.plans.find((p) => p.id === id);
  const setStore = usePracticeStore((s) => s.setStore);
  const catalog = usePracticeCatalog(locale);
  const habits = catalog.data?.habits ?? [];
  const habit = plan ? habitFor(plan, habits) : undefined;
  const evidence = useEvidence(habit?.evidence ?? [], locale);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const planDays = usePlanDays();
  const show = useDisplayTime();

  const [relapseDismissed, setRelapseDismissed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fixingLog, setFixingLog] = useState(false);
  const [mending, setMending] = useState(false);

  if (!hydrated) return <Loading />;
  if (!plan) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon={SearchX} message={t('practice.plan.notFound')} actionLabel={t('common.back')} onAction={() => router.back()} />
      </Screen>
    );
  }

  const d = today();
  const view = planView(plan, d);
  const unitFallback = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };
  const amountLabel = (n: number) => formatAmount(n, plan.unit, habit, locale, unitFallback);
  const title = habit ? pick(habit, 'title', locale) : plan.title;
  const paused = isPaused(plan);
  const weekdays = ruleToWeekdays(planRule(plan, habits));
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  // «3 أيام في الأسبوع · بعد الفجر، 21:00 · 5 دقائق»: the schedule and today's amount in one line.
  const slotWords = slotChoices(plan).map((s) => (isPrayerAnchor(s) ? ANCHOR_LABELS[lang][s] : show(s)));
  const schedule = [
    weekdays ? t('habitsTab.plan.daysPerWeek', { days: t('practice.add.daysCount', { count: weekdays.length }) }) : null,
    slotWords.join(lang === 'ar' ? '، ' : ', '),
    amountLabel(view.required),
  ]
    .filter(Boolean)
    .join(' · ');

  // A slot chosen before the deed had a time window (e.g. «بعد الظهر» on Duha): a short notice and one fix.
  const prayerDay = currentPrayerDay(d);
  const offSlots = habit?.window ? unsuitableChoices(slotChoices(plan), habit.window, prayerDay) : [];
  const range = windowRange(habit?.window, prayerDay);
  const mend = mendState({
    offer: makeUpOffer(store, plan, d, { ...planDays, heart }),
    missedYesterday: missedDayBefore(store, plan, d, planDays),
    doneToday: plan.log[d] ?? 0,
    paused,
  });
  const answers = answersOf(plan.loops);

  // practice-core `updatePlan` keeps `updatedAt` right for sync (a log alone does not bump it).
  function update(fn: (p: Plan) => Plan) {
    setStore((s) => updatePlan(s, id as string, fn));
  }

  function handleFixSlots() {
    if (!habit || !plan) return;
    const ordered = orderedSlots(fixedChoices(slotChoices(plan), habit.defaultSlots, habit.window, prayerDay));
    update((p) => {
      const next: Plan = { ...p, slots: ordered.slots };
      if (ordered.slotAnchors) next.slotAnchors = ordered.slotAnchors;
      else delete next.slotAnchors;
      return next;
    });
    toast(t('practice.plan.settingsSaved'));
  }

  function handleFixSave(date: string, amount: number) {
    update((p) => correctLog(p, date, amount));
    setFixingLog(false);
    toast(t('practice.plan.fixSaved'));
  }

  function handlePause() {
    update((p) => pausePlan(p, d));
    toast(t('practice.paused.done'));
  }

  function handleResume() {
    update((p) => resumePlan(p, d));
    toast(t('practice.paused.resumed'));
  }

  function handleRemove() {
    setStore((s) => deletePlan(s, id as string));
    router.back();
    toast(t('practice.plan.deleted'));
  }

  // «⋯» (A-15): «عدّل», pause or resume, and delete (red, confirmed in the menu's own sheet). Signed in, the deletion
  // syncs to the account (a tombstone), so the confirmation does not say «من هذا الجهاز».
  const renderMenu = () => (
    <ActionMenu
      items={[
        { label: t('habitsTab.plan.edit'), icon: PencilLine, onPress: () => setEditing(true) },
        paused
          ? { label: t('practice.paused.resume'), icon: Play, onPress: handleResume }
          : { label: t('practice.paused.pause'), icon: Pause, onPress: handlePause, hint: t('practice.paused.pauseHint') },
        {
          label: t('practice.plan.delete'),
          icon: Trash2,
          destructive: true,
          onPress: handleRemove,
          confirm: {
            title: t('practice.plan.delete'),
            message: t(signedIn ? 'practice.plan.deleteConfirmSynced' : 'practice.plan.deleteConfirm'),
            confirmLabel: t('common.delete'),
          },
        },
      ]}
    />
  );

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title, headerRight: renderMenu }} />
      <PageHeader
        title={title}
        action={<Button label={t('habitsTab.plan.edit')} icon={PencilLine} variant="outline" size="sm" onPress={() => setEditing(true)} />}
      >
        <Text variant="small" tone="muted">
          {schedule}
        </Text>
      </PageHeader>

      {paused ? (
        <NextStep title={t('practice.paused.since', { date: plan.pausedOn ? shortDate(plan.pausedOn) : '' })}>
          <Wrap style={styles.offerActions}>
            <Button label={t('practice.paused.resume')} onPress={handleResume} />
          </Wrap>
        </NextStep>
      ) : null}

      {offSlots.length > 0 ? (
        <NextStep title={t('practice.window.unsuitable')}>
          {range ? <Text variant="small">{t('practice.window.line', { from: show(range.from), to: show(range.to) })}</Text> : null}
          <Wrap style={styles.offerActions}>
            <Button label={t('practice.window.fix')} onPress={handleFixSlots} variant="outline" />
          </Wrap>
        </NextStep>
      ) : null}

      {graduationReady(plan, d) ? (
        <NextStep title={t('practice.graduation.offer')}>
          <Wrap style={styles.offerActions}>
            <Button
              label={t('practice.graduation.action')}
              onPress={() => {
                update((p) => establishPlan(p, d));
                toast(t('habitsTab.record.establishedToast'));
              }}
              variant="outline"
            />
          </Wrap>
        </NextStep>
      ) : null}

      {showsMend(mend) ? (
        <NextStep title={t(mend === 'steps' ? 'practice.hub.missedYesterday' : 'habitsTab.mend.offerLine')}>
          <Wrap style={styles.offerActions}>
            <Button label={t('myHabits.fix')} onPress={() => setMending(true)} variant="outline" />
          </Wrap>
        </NextStep>
      ) : null}

      <View>
        <MonthPanel plan={plan} view={view} today={d} />
        <Wrap style={styles.offerActions}>
          <Button label={t('practice.plan.fixOpen')} icon={PencilLine} onPress={() => setFixingLog(true)} variant="ghost" size="sm" />
        </Wrap>
      </View>

      {!paused && view.canIncrease && view.nextAmount !== null ? (
        <NextStep title={t('practice.increase.title')}>
          <Text variant="small">{t('practice.increase.body', { amount: amountLabel(view.nextAmount) })}</Text>
          <Wrap style={styles.offerActions}>
            <Button
              label={t('practice.increase.action')}
              onPress={() => {
                update((p) => increase(normalize(p, d), d));
                toast(t('habitsTab.plan.increasedToast'));
              }}
            />
          </Wrap>
        </NextStep>
      ) : null}

      {!paused && view.relapse && !relapseDismissed ? (
        <NextStep title={t('practice.relapse.title')}>
          <Text variant="small">{t('practice.relapse.body', { amount: amountLabel(view.relapseAmount) })}</Text>
          <ButtonPair
            style={styles.offerActions}
            primary={{
              label: t('practice.relapse.action', { amount: amountLabel(view.relapseAmount) }),
              onPress: () => {
                update((p) => decreaseTo(normalize(p, d), view.relapseAmount, d));
                toast(t('practice.plan.settingsSaved'));
              },
              variant: 'outline',
            }}
            secondary={{ label: t('practice.relapse.keep'), onPress: () => setRelapseDismissed(true), variant: 'ghost' }}
          />
        </NextStep>
      ) : null}

      {answers.after || answers.ifBlocked ? (
        <>
          <SectionDivider />
          <Section title={t('habitsTab.plan.answersTitle')}>
            <View>
              {answers.after ? (
                <View style={[styles.answer, !answers.ifBlocked && styles.answerLast]}>
                  <Text variant="caption" tone="muted">
                    {t('habitsTab.loop.after')}
                  </Text>
                  <Text variant="body">{answers.after}</Text>
                </View>
              ) : null}
              {answers.ifBlocked ? (
                <View style={[styles.answer, styles.answerLast]}>
                  <Text variant="caption" tone="muted">
                    {t('habitsTab.loop.ifBlocked')}
                  </Text>
                  <Text variant="body">{answers.ifBlocked}</Text>
                </View>
              ) : null}
            </View>
          </Section>
        </>
      ) : null}

      {habit?.evidence?.length ? <SectionDivider /> : null}
      <EvidenceList
        ids={habit?.evidence}
        byId={evidence.data}
        loading={evidence.isLoading}
        error={evidence.isError}
        title={t('practice.evidenceDeedTitle')}
        subtitle={title}
        limit={1}
        moreHref={habit ? `/good-deeds/${habit.deed}` : undefined}
      />

      <PlanEditSheet
        visible={editing}
        plan={plan}
        title={title}
        window={habit?.window}
        ruleWeekdays={weekdays}
        onClose={() => setEditing(false)}
        onSave={(next) => {
          update(() => next);
          setEditing(false);
          toast(t('practice.plan.settingsSaved'));
        }}
      />
      <BottomSheet visible={fixingLog} title={t('practice.plan.fixOpen')} onClose={() => setFixingLog(false)}>
        <FixPanel plan={plan} today={d} amountLabel={amountLabel} onSave={handleFixSave} onCancel={() => setFixingLog(false)} />
      </BottomSheet>
      <HabitFixSheet visible={mending} onClose={() => setMending(false)} plan={plan} habit={habit} title={title} today={d} />
    </Screen>
  );
}
