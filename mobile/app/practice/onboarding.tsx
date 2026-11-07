/**
 * The first steps after sign-up (owner round 5, F-26 a): three short, skippable screens, shown once
 * (src/lib/practice/onboarding.ts):
 * 1. «ماذا تريد الآن؟»: a good deed, leaving a sin (nothing is named here), or only reading;
 * 2. a good deed: pick ONE habit, started at its smallest amount;
 * 3. the reminder time (the habit's, or «تخفَّف»'s), and the «الفرائض» switch (F-05 a).
 * Then «عاداتي › ورد اليوم» with the habit, «تخفَّف» to choose the program in its locked screen, or the home page.
 * Each screen has «التالي» beside «تخطَّ» (A-06): skipping keeps the defaults (no habit, the habit's own time).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fardEnabled, setFardTracking, startSuggestion, upsertPlan, validatePlan, type LocalTime } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { ruleToWeekdays } from '@/lib/practice/format';
import { activeDaysFrom } from '@/lib/practice/habits-view';
import { markOnboardingSeen } from '@/lib/practice/onboarding-flag';
import { onboardingLanding, onboardingNext, type OnboardingGoal, type OnboardingStep } from '@/lib/practice/onboarding';
import { planFromHabit, startAmount } from '@/lib/practice/plan-view';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { TimeField } from '@/components/practice/editors';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import { ButtonPair, CheckRow, PageHeader, Screen, Skeleton, SwitchRow, Text, toast } from '@/ui';

const DEFAULT_TIME: LocalTime = '08:00';

const makeStyles = (t: Theme) => ({
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['2xl'], gap: space.xl },
  group: { gap: space.md },
  progress: { flexDirection: 'row' as const, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: t.colors.border },
  dotOn: { backgroundColor: t.colors.primary },
  footer: {
    paddingHorizontal: GUTTER,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
});

const STEPS: OnboardingStep[] = ['goal', 'pick', 'time'];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const catalog = usePracticeCatalog(locale);
  const store = usePracticeStore((s) => s.store);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const sinTime = usePracticeStore((s) => s.prefs.sinReminderTime);
  const [step, setStep] = useState<OnboardingStep>('goal');
  const [goal, setGoal] = useState<OnboardingGoal | null>(null);
  const [habitKey, setHabitKey] = useState<string | null>(null);
  const [time, setTime] = useState<LocalTime>(DEFAULT_TIME);
  const habits = useMemo(() => (catalog.data?.habits ?? []).filter((h) => !h.people && h.kind !== 'periodic'), [catalog.data]);
  const habit = habits.find((h) => h.key === habitKey);

  // The time step opens on the habit's own first fixed time, or «تخفَّف»'s.
  useEffect(() => {
    if (step !== 'time') return;
    if (goal === 'sin') setTime(sinTime);
    else if (habit) setTime(habit.defaultSlots.find((s) => /^\d\d:\d\d$/.test(s)) ?? DEFAULT_TIME);
  }, [step, goal, habit, sinTime]);

  function finish(created: boolean) {
    void markOnboardingSeen();
    router.replace(onboardingLanding(goal, created));
  }

  function complete() {
    if (goal === 'deed' && habit) {
      const rule = habit.defaultRule;
      const plan = planFromHabit({
        id: newPracticeId(),
        habit,
        amount: startAmount(habit, 'far', startSuggestion),
        slots: [time],
        activeDaysPerWeek: activeDaysFrom(ruleToWeekdays(rule), 3),
        rule,
        today: today(),
        locale,
      });
      if (validatePlan(plan) === null) {
        setStore((s) => upsertPlan(s, plan));
        toast(t('practice.add.addedToast', { habit: pick(habit, 'title', locale) }));
        finish(true);
        return;
      }
    }
    if (goal === 'sin') setPrefs((p) => ({ ...p, sinReminders: true, sinReminderTime: time }));
    finish(false);
  }

  function next() {
    const after = onboardingNext(step, goal);
    if (after === 'done') complete();
    else setStep(after);
  }

  const index = goal === 'sin' && step === 'time' ? 1 : STEPS.indexOf(step);
  const total = goal === 'sin' ? 2 : goal === 'read' ? 1 : 3;
  const canNext = step === 'goal' ? goal !== null : step === 'pick' ? habit !== undefined : true;
  const unitFallback = { minutes: t('practice.units.minutes'), count: t('practice.units.count'), times: t('practice.units.times') };

  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={styles.frame}>
      <Stack.Screen options={{ title: t('onboarding.title') }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: index + 1 }}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.dot, i <= index && styles.dotOn]} />
          ))}
        </View>

        {step === 'goal' ? (
          <>
            <PageHeader title={t('onboarding.goal.title')} lead={t('onboarding.goal.lead')} />
            <View style={styles.group} accessibilityRole="radiogroup">
              {(['deed', 'sin', 'read'] as const).map((key) => (
                <CheckRow key={key} radio title={t(`onboarding.goal.${key}`)} hint={t(`onboarding.goal.${key}Hint`)} checked={goal === key} onPress={() => setGoal(key)} />
              ))}
            </View>
          </>
        ) : null}

        {step === 'pick' ? (
          <>
            <PageHeader title={t('onboarding.pick.title')} lead={t('onboarding.pick.lead')} />
            {catalog.isLoading ? (
              <Skeleton height={220} />
            ) : (
              <View style={styles.group} accessibilityRole="radiogroup">
                {habits.map((h) => {
                  const amount = startAmount(h, 'far', startSuggestion);
                  return (
                    <CheckRow
                      key={h.key}
                      radio
                      title={pick(h, 'title', locale)}
                      hint={t('onboarding.pick.start', { amount: formatAmount(amount, h.unit, h, locale, unitFallback) })}
                      checked={habitKey === h.key}
                      onPress={() => setHabitKey(h.key)}
                    />
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        {step === 'time' ? (
          <>
            <PageHeader title={t('onboarding.time.title')} lead={t(goal === 'sin' ? 'onboarding.time.leadSin' : 'onboarding.time.lead')} />
            <TimeField label={t('onboarding.time.label')} value={time} onChange={setTime} />
            <SwitchRow
              label={t('habitsTab.add.fard')}
              hint={t('habitsTab.add.fardHint')}
              value={fardEnabled(store)}
              onValueChange={(on) => setStore((s) => setFardTracking(s, on))}
            />
          </>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <ButtonPair
          size="lg"
          primary={{ label: goal !== null && onboardingNext(step, goal) === 'done' ? t('onboarding.start') : t('practice.add.next'), onPress: next, disabled: !canNext, arrow: true }}
          secondary={{ label: t('practice.onboarding.skip'), onPress: step === 'goal' ? () => finish(false) : next }}
        />
      </View>
    </Screen>
  );
}
