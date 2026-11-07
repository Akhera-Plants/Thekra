/**
 * One habit plan, after the website's PlanCard: today's amount with «أتممتها» and a partial «+1», «سُجِّل · تراجع»,
 * a typed partial amount, «صحّح السجل» (a week back, steppers for the day and the amount), the increase and relapse offers as next-step
 * notes, the last 30 days (a kind band and a row of dots, no streaks and no failure words), slot/day settings, and
 * «التزامي» (while «التزام شخصي» is on: the habit's make-up deed, PledgeSheet) and «آيات وأحاديث تعينك على هذه
 * الطاعة» (O-05): one evidence text from the API with «المزيد» on the title's line to the deed's page, which reads the
 * rest. Sections in that order, separated by the flower divider: اليوم / آخر 30 يومًا / التزامي / الإعدادات / الآيات.
 * Pause and delete live in the header's «⋯» menu (A-15; delete confirmed there). Logs confirm with a toast.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { CircleCheck, Pause, Play, SearchX, Trash2 } from 'lucide-react-native';
import { useDisplayTime } from '@/components/practice/editors';
import { fixedChoices, unsuitableChoices, windowRange } from '@/lib/practice/deed-window';
import { currentPrayerDay } from '@/lib/practice/prayer';
import {
  correctLog,
  decreaseTo,
  deletePlan,
  establishPlan,
  graduationReady,
  isPaused,
  pausePlan,
  resumePlan,
  increase,
  logDone,
  normalize,
  orderedSlots,
  slotChoices,
  updatePlan,
  type Plan,
  type Pledge,
} from '@thekra/practice-core';
import { useEvidence, usePracticeCatalog } from '@/lib/api/practice';
import { useCirclePresence } from '@/lib/circles/use-circle-presence';
import { pick } from '@/lib/practice/catalog-types';
import { ruleToWeekdays, shortDate } from '@/lib/practice/format';
import { planView } from '@/lib/practice/plan-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { pledgeOfPlan } from '@/lib/practice/pledges';
import { formatAmount, habitFor, planRule } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { MonthPanel, SettingsPanel } from '@/components/practice/PlanHistoryAndSettings';
import { TodayPanel } from '@/components/practice/PlanTodayCard';
import { PledgeSheet, usePledgeDone } from '@/components/practice/PledgeSheet';
import { pledgeWords } from '@/components/practice/hub/HeartCards';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import {
  ActionMenu,
  Button,
  ButtonPair,
  EmptyState,
  ForwardChevron,
  Loading,
  NextStep,
  Notice,
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
  pledgeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: radius.card,
    backgroundColor: t.colors.card,
  },
  pledgeText: { flex: 1 },
});

type T = (key: string, opts?: Record<string, unknown>) => string;

/** «التزامي»: the habit's deed (opens its sheet), or a bordered «اختر عملًا». */
function PledgeLine({ pledge, title, onOpen }: { pledge: Pledge | undefined; title: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  if (!pledge) return <Button label={t('practice.notifyPrefs.pledgeChoose')} onPress={onOpen} variant="outline" />;
  const words = t('practice.notifyPrefs.pledgeIfShort', { deed: pledgeWords(pledge, t as unknown as T, locale) });
  return (
    <Pressable
      onPress={onOpen}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${words}`}
      style={({ pressed }) => [styles.pledgeRow, pressed && { opacity: 0.75 }]}
    >
      <Text variant="body" style={styles.pledgeText}>
        {words}
      </Text>
      <ForwardChevron size={18} tone="muted" />
    </Pressable>
  );
}

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const hydrated = usePracticeStore((s) => s.hydrated);
  const plan = usePracticeStore((s) => s.store.plans.find((p) => p.id === id));
  const setStore = usePracticeStore((s) => s.setStore);
  useCirclePresence(); // «حضرت اليوم» to the user's circles (رفقة), when sharing is on there
  const catalog = usePracticeCatalog(locale);
  const habits = catalog.data?.habits ?? [];
  const habit = plan ? habitFor(plan, habits) : undefined;
  const evidence = useEvidence(habit?.evidence ?? [], locale);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const show = useDisplayTime();

  const [relapseDismissed, setRelapseDismissed] = useState(false);
  /** «صحّح السجل» is open. */
  const [fixing, setFixing] = useState(false);
  const pledgesOn = usePracticeStore((s) => s.heart.prefs.pledges);
  const pledge = usePracticeStore((s) => (id ? pledgeOfPlan(s.heart, id) : undefined));
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [pledgeDone, showPledgeDone] = usePledgeDone();

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
  const timeHint = habit ? pick(habit, 'timeHint', locale) : '';
  // A slot chosen before the deed had a time window (e.g. «بعد الظهر» on Duha): a short notice and one fix.
  const prayerDay = currentPrayerDay(d);
  const offSlots = habit?.window ? unsuitableChoices(slotChoices(plan), habit.window, prayerDay) : [];
  const range = windowRange(habit?.window, prayerDay);

  function handleFixSlots() {
    if (!habit) return;
    const ordered = orderedSlots(fixedChoices(slotChoices(plan!), habit.defaultSlots, habit.window, prayerDay));
    update((p) => {
      const next: Plan = { ...p, slots: ordered.slots };
      if (ordered.slotAnchors) next.slotAnchors = ordered.slotAnchors;
      else delete next.slotAnchors;
      return next;
    });
  }

  // practice-core `updatePlan` keeps `updatedAt` right for sync (a log alone does not bump it).
  function update(fn: (p: Plan) => Plan) {
    setStore((s) => updatePlan(s, id as string, fn));
  }

  function handleLog(amount: number) {
    const before = plan!.log[d] ?? 0;
    update((p) => logDone(p, d, amount));
    if (!view.doneToday && amount >= view.remaining) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // «سُجّلت» with «تراجع» in the toast (A-11, A-23): the undo restores the day as it was before this tap.
    toast({ message: t('practice.plan.logged'), actionLabel: t('practice.plan.undo'), onAction: () => update((p) => correctLog(p, d, before)) });
  }

  function handleFixSave(date: string, amount: number) {
    update((p) => correctLog(p, date, amount));
    setFixing(false);
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

  // Page actions behind «⋯» (A-15): pause or resume, and delete (red, confirmed in the menu's own sheet). Signed in,
  // the deletion syncs to the account (a tombstone), so the confirmation does not say «من هذا الجهاز».
  const paused = isPaused(plan);
  const renderMenu = () => (
    <ActionMenu
      items={[
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
    <Screen edges={['bottom']} keyboard>
      <Stack.Screen options={{ title, headerRight: renderMenu }} />
      <PageHeader eyebrow={t('practice.title')} title={title} lead={habit ? t(`practice.basis.${habit.basis}`) : undefined}>
        {timeHint ? (
          <Text variant="small" tone="muted">
            {t('practice.add.timeHint', { hint: timeHint })}
          </Text>
        ) : null}
      </PageHeader>

      {offSlots.length > 0 ? (
        <NextStep title={t('practice.window.unsuitable')}>
          {range ? <Text variant="small">{t('practice.window.line', { from: show(range.from), to: show(range.to) })}</Text> : null}
          <Wrap style={styles.offerActions}>
            <Button label={t('practice.window.fix')} onPress={handleFixSlots} variant="outline" />
          </Wrap>
        </NextStep>
      ) : null}

      {isPaused(plan) ? (
        <NextStep title={t('practice.paused.since', { date: plan.pausedOn ? shortDate(plan.pausedOn) : '' })}>
          <Wrap style={styles.offerActions}>
            <Button label={t('practice.paused.resume')} onPress={handleResume} />
          </Wrap>
        </NextStep>
      ) : null}

      {graduationReady(plan, d) ? (
        <NextStep title={t('practice.graduation.offer')}>
          <Wrap style={styles.offerActions}>
            <Button label={t('practice.graduation.action')} onPress={() => update((p) => establishPlan(p, d))} variant="outline" />
          </Wrap>
        </NextStep>
      ) : null}

      {isPaused(plan) ? null : (
        <Section title={t('practice.plan.today')}>
          <TodayPanel
            plan={plan}
            view={view}
            today={d}
            amountLabel={amountLabel}
            unitLabel={habit ? pick(habit, 'unitLabel', locale) : t(`practice.units.${plan.unit}`)}
            fixing={fixing}
            onLog={handleLog}
            onFixOpen={() => setFixing(true)}
            onFixSave={handleFixSave}
            onFixCancel={() => setFixing(false)}
          />

          {view.relapse && !relapseDismissed ? (
            <NextStep title={t('practice.relapse.title')}>
              <Text variant="small">{t('practice.relapse.body', { amount: amountLabel(view.relapseAmount) })}</Text>
              <ButtonPair
                style={styles.offerActions}
                primary={{
                  label: t('practice.relapse.action', { amount: amountLabel(view.relapseAmount) }),
                  onPress: () => update((p) => decreaseTo(normalize(p, d), view.relapseAmount, d)),
                  variant: 'outline',
                }}
                secondary={{ label: t('practice.relapse.keep'), onPress: () => setRelapseDismissed(true), variant: 'ghost' }}
              />
            </NextStep>
          ) : null}

          {view.canIncrease && view.nextAmount !== null ? (
            <NextStep title={t('practice.increase.title')}>
              <Text variant="small">{t('practice.increase.body', { amount: amountLabel(view.nextAmount) })}</Text>
              <Wrap style={styles.offerActions}>
                <Button label={t('practice.increase.action')} onPress={() => update((p) => increase(normalize(p, d), d))} variant="outline" />
              </Wrap>
            </NextStep>
          ) : null}
        </Section>
      )}

      {isPaused(plan) ? null : <SectionDivider />}

      <MonthPanel plan={plan} view={view} today={d} />

      <SectionDivider />

      {pledgesOn ? (
        <>
          <Section title={t('practice.notifyPrefs.pledgeMine')}>
            <PledgeLine pledge={pledge} title={title} onOpen={() => setPledgeOpen(true)} />
            {pledgeDone ? (
              <View accessibilityLiveRegion="polite">
                <Notice icon={CircleCheck}>{pledgeDone}</Notice>
              </View>
            ) : null}
          </Section>
          <PledgeSheet visible={pledgeOpen} planId={plan.id} habitTitle={title} onClose={() => setPledgeOpen(false)} onDone={showPledgeDone} />
          <SectionDivider />
        </>
      ) : null}

      <SettingsPanel
        plan={plan}
        window={habit?.window}
        ruleWeekdays={ruleToWeekdays(planRule(plan, habits))}
        onSave={(next) => {
          update(() => next);
          toast(t('practice.plan.settingsSaved'));
        }}
      />

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
    </Screen>
  );
}
