/**
 * One habit plan, after the website's PlanCard: today's amount with «أتممتها» and a partial «+1», «سُجِّل · تراجع»,
 * «صحّح السجل» (a week back, steppers for the day and the amount), the increase and relapse offers as next-step
 * notes, the last 30 days (a kind band and a row of dots, no streaks and no failure words), slot/day settings, and
 * «المُعينات»: one evidence text from the API with «المزيد» to the deed's page, which reads the rest. Delete is the
 * trash in the native header (confirmed), reachable without scrolling. A quiet «اقرأ عن هذه الطاعة» opens the deed's page.
 */

import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { SearchX, Trash2 } from 'lucide-react-native';
import {
  correctLog,
  decreaseTo,
  deletePlan,
  increase,
  logDone,
  normalize,
  updatePlan,
  type Plan,
} from '@thekra/practice-core';
import { useEvidence, usePracticeCatalog } from '@/lib/api/practice';
import { useCirclePresence } from '@/lib/circles/use-circle-presence';
import { pick } from '@/lib/practice/catalog-types';
import { ruleToWeekdays } from '@/lib/practice/format';
import { planView } from '@/lib/practice/plan-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor, planRule } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { MonthPanel, SettingsPanel } from '@/components/practice/PlanHistoryAndSettings';
import { TodayPanel } from '@/components/practice/PlanTodayCard';
import { space, useStyles } from '@/theme';
import {
  Button,
  EmptyState,
  IconButton,
  Loading,
  NextStep,
  PageHeader,
  Rule,
  Screen,
  Text,
  TextLink,
  Wrap,
} from '@/ui';

const makeStyles = () => ({
  offerActions: { marginTop: space.sm },
});

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

  const [relapseDismissed, setRelapseDismissed] = useState(false);
  /** The last log in this visit, so it can be undone in one tap. */
  const [lastLog, setLastLog] = useState<{ date: string; before: number } | null>(null);
  /** «صحّح السجل» is open. */
  const [fixing, setFixing] = useState(false);

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

  // practice-core `updatePlan` keeps `updatedAt` right for sync (a log alone does not bump it).
  function update(fn: (p: Plan) => Plan) {
    setStore((s) => updatePlan(s, id as string, fn));
  }

  function handleLog(amount: number) {
    setLastLog({ date: d, before: plan!.log[d] ?? 0 });
    update((p) => logDone(p, d, amount));
    if (!view.doneToday && amount >= view.remaining) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleUndo() {
    if (!lastLog) return;
    const { date, before } = lastLog;
    update((p) => correctLog(p, date, before));
    setLastLog(null);
  }

  function handleFixSave(date: string, amount: number) {
    update((p) => correctLog(p, date, amount));
    setFixing(false);
    setLastLog(null);
  }

  function handleRemove() {
    Alert.alert(t('practice.plan.delete'), t('practice.plan.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setStore((s) => deletePlan(s, id as string));
          router.back();
        },
      },
    ]);
  }

  const renderDeleteButton = () => <IconButton icon={Trash2} label={t('practice.plan.delete')} onPress={handleRemove} />;

  return (
    <Screen edges={['bottom']} keyboard>
      <Stack.Screen options={{ title, headerRight: renderDeleteButton }} />
      <PageHeader eyebrow={t('practice.title')} title={title} lead={habit ? t(`practice.basis.${habit.basis}`) : undefined}>
        {timeHint ? (
          <Text variant="small" tone="muted">
            {t('practice.add.timeHint', { hint: timeHint })}
          </Text>
        ) : null}
        {habit ? <TextLink label={t('practice.plan.readAbout')} onPress={() => router.push(`/good-deeds/${habit.deed}`)} muted /> : null}
      </PageHeader>

      <TodayPanel
        plan={plan}
        view={view}
        today={d}
        amountLabel={amountLabel}
        logged={lastLog !== null}
        fixing={fixing}
        onLog={handleLog}
        onUndo={handleUndo}
        onFixOpen={() => setFixing(true)}
        onFixSave={handleFixSave}
        onFixCancel={() => setFixing(false)}
      />

      {view.relapse && !relapseDismissed ? (
        <NextStep title={t('practice.relapse.title')}>
          <Text variant="small">{t('practice.relapse.body', { amount: amountLabel(view.relapseAmount) })}</Text>
          <Wrap style={styles.offerActions}>
            <Button
              label={t('practice.relapse.action', { amount: amountLabel(view.relapseAmount) })}
              onPress={() => update((p) => decreaseTo(normalize(p, d), view.relapseAmount, d))}
              variant="outline"
            />
            <Button label={t('practice.relapse.keep')} onPress={() => setRelapseDismissed(true)} variant="ghost" />
          </Wrap>
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

      <MonthPanel plan={plan} view={view} today={d} />

      <Rule />

      <SettingsPanel plan={plan} ruleWeekdays={ruleToWeekdays(planRule(plan, habits))} onSave={(next) => update(() => next)} />

      <EvidenceList
        ids={habit?.evidence}
        byId={evidence.data}
        loading={evidence.isLoading}
        error={evidence.isError}
        title={t('practice.plan.helpers')}
        limit={1}
        moreHref={habit ? `/good-deeds/${habit.deed}` : undefined}
      />
    </Screen>
  );
}
