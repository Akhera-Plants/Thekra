/**
 * One habit plan: today's amount and log, the monthly adherence band (no streaks, no failure words), the
 * one-step increase (only when practice-core `canIncrease`), the relapse suggestion (`status` = 'relapse' →
 * `relapseSuggestion`), slot/day settings, and the evidence texts from the API.
 */

import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  correctLog,
  decreaseTo,
  deletePlan,
  increase,
  logDone,
  normalize,
  updatePlan,
  validatePlan,
  type LocalTime,
  type Plan,
} from '@thekra/practice-core';
import { useEvidence, usePracticeCatalog } from '@/lib/api/practice';
import { pick } from '@/lib/practice/catalog-types';
import { ruleToWeekdays, shortDate, sortSlots, weekdaysToRule } from '@/lib/practice/format';
import { planView } from '@/lib/practice/plan-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount, habitFor, planRule } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { ActiveDaysPicker, SlotsEditor, WeekdayPicker } from '@/components/practice/editors';
import { Body, Button, Card, ErrorText, Loading, Row, Screen, SectionTitle, Title } from '@/components/practice/ui';

/** «صحّح السجل» reaches this many days back (today included). */
const FIX_DAYS = 7;
const FIX_MAX = 1000;

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const locale = useUiLocale();
  const hydrated = usePracticeStore((s) => s.hydrated);
  const plan = usePracticeStore((s) => s.store.plans.find((p) => p.id === id));
  const setStore = usePracticeStore((s) => s.setStore);
  const catalog = usePracticeCatalog(locale);
  const habits = catalog.data?.habits ?? [];
  const habit = plan ? habitFor(plan, habits) : undefined;
  const evidence = useEvidence(habit?.evidence ?? [], locale);

  const [slots, setSlots] = useState<LocalTime[]>([]);
  const [activeDays, setActiveDays] = useState(3);
  const [weekdays, setWeekdays] = useState<number[] | null>(null);
  const [relapseDismissed, setRelapseDismissed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The last log in this visit, so it can be undone in one tap. */
  const [lastLog, setLastLog] = useState<{ date: string; before: number } | null>(null);
  /** «صحّح السجل»: how many days back (0 = today) and the amount to set; null while closed. */
  const [fix, setFix] = useState<{ back: number; amount: number } | null>(null);

  const ruleKey = plan ? JSON.stringify(planRule(plan, habits)) : '';
  useEffect(() => {
    if (!plan) return;
    setSlots(plan.slots);
    setActiveDays(plan.activeDaysPerWeek);
    setWeekdays(ruleToWeekdays(planRule(plan, habits)));
    // Reset the editors when the stored plan's settings change, not on every log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, plan?.slots.join(','), plan?.activeDaysPerWeek, ruleKey]);

  if (!hydrated) return <Loading />;
  if (!plan) {
    return (
      <Screen>
        <Body>{t('practice.plan.notFound')}</Body>
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

  function log(amount: number) {
    setLastLog({ date: d, before: plan!.log[d] ?? 0 });
    update((p) => logDone(p, d, amount));
  }

  function undoLastLog() {
    if (!lastLog) return;
    const { date, before } = lastLog;
    update((p) => correctLog(p, date, before));
    setLastLog(null);
  }

  // A forgotten or wrong day, up to a week back and never before the plan started.
  const fixDate = fix ? addDays(d, -fix.back) : d;
  const canGoBack = fix !== null && fix.back < FIX_DAYS - 1 && addDays(d, -(fix.back + 1)) >= plan.createdOn;
  const fixLabel = fix?.back === 0 ? t('practice.plan.fixToday') : fix?.back === 1 ? t('practice.plan.fixYesterday') : shortDate(fixDate);

  function moveFixDay(step: number) {
    if (!fix) return;
    const back = fix.back + step;
    setFix({ back, amount: plan!.log[addDays(d, -back)] ?? 0 });
  }

  function saveFix() {
    if (!fix) return;
    const amount = fix.amount;
    update((p) => correctLog(p, fixDate, amount));
    setFix(null);
    setLastLog(null);
  }

  function saveSettings() {
    setError(null);
    const rule = weekdays ? weekdaysToRule(weekdays) : null;
    if (weekdays && !rule) {
      setError(t('practice.add.noReminderDays'));
      return;
    }
    const next: Plan = { ...plan!, slots: sortSlots(slots), activeDaysPerWeek: activeDays, ...(rule ? { rule } : {}) };
    if (validatePlan(next) !== null) {
      setError(t('practice.add.noSlots'));
      return;
    }
    update(() => next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function remove() {
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

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Title>{title}</Title>
      {habit ? <Body muted small>{t(`practice.basis.${habit.basis}`)}</Body> : null}
      {timeHint ? <Body muted small>{t('practice.add.timeHint', { hint: timeHint })}</Body> : null}

      <Card>
        <Body>{t('practice.plan.required', { amount: amountLabel(view.required) })}</Body>
        {view.done > 0 ? <Body muted>{t('practice.plan.done', { amount: amountLabel(view.done) })}</Body> : null}
        {view.inEbb ? <Body muted small>{t('practice.ebbActive')}</Body> : null}
        <Row>
          <Button label={t('practice.logPlusOne')} onPress={() => log(1)} variant="outline" compact />
          {!view.doneToday ? (
            <Button label={t('practice.logRest')} onPress={() => log(view.remaining)} compact />
          ) : (
            <Body>{t('practice.doneToday')}</Body>
          )}
        </Row>
        <Body muted small>
          {t('practice.partialHint')}
        </Body>
        {lastLog ? (
          <Row>
            <Body muted small>{t('practice.plan.logged')}</Body>
            <Button label={t('practice.plan.undo')} onPress={undoLastLog} variant="ghost" compact />
          </Row>
        ) : null}
        {fix === null ? (
          <Button label={t('practice.plan.fixOpen')} onPress={() => setFix({ back: 0, amount: plan.log[d] ?? 0 })} variant="ghost" compact />
        ) : null}
      </Card>

      {fix ? (
        <Card>
          <Body muted small>{t('practice.plan.fixHint')}</Body>
          <Row>
            <Button label="‹" accessibilityLabel={t('practice.plan.fixEarlier')} onPress={() => moveFixDay(1)} variant="outline" compact disabled={!canGoBack} />
            <Body>{fixLabel}</Body>
            <Button label="›" accessibilityLabel={t('practice.plan.fixLater')} onPress={() => moveFixDay(-1)} variant="outline" compact disabled={fix.back === 0} />
          </Row>
          <Row>
            <Button label="−" accessibilityLabel={t('practice.plan.fixLess')} onPress={() => setFix({ ...fix, amount: Math.max(0, fix.amount - 1) })} variant="outline" compact disabled={fix.amount <= 0} />
            <Body>{amountLabel(fix.amount)}</Body>
            <Button label="+" accessibilityLabel={t('practice.plan.fixMore')} onPress={() => setFix({ ...fix, amount: Math.min(FIX_MAX, fix.amount + 1) })} variant="outline" compact />
          </Row>
          <Row>
            <Button label={t('practice.plan.save')} onPress={saveFix} compact />
            <Button label={t('common.cancel')} onPress={() => setFix(null)} variant="ghost" compact />
          </Row>
        </Card>
      ) : null}

      <Card tone="info">
        <Body>{t('practice.monthTitle')}: {t(`practice.band.${view.band}`)}</Body>
        <Body muted small>
          {t(`practice.band.${view.band}Hint`)}
        </Body>
        <Body muted small>
          {t('practice.monthDays', { done: String(view.daysDone), target: String(view.targetDays) })}
        </Body>
      </Card>

      {view.relapse && !relapseDismissed ? (
        <Card tone="warning">
          <Body>{t('practice.relapse.title')}</Body>
          <Body muted>{t('practice.relapse.body', { amount: amountLabel(view.relapseAmount) })}</Body>
          <Row style={{ flexWrap: 'wrap' }}>
            <Button
              label={t('practice.relapse.action', { amount: amountLabel(view.relapseAmount) })}
              onPress={() => update((p) => decreaseTo(normalize(p, d), view.relapseAmount, d))}
              compact
            />
            <Button label={t('practice.relapse.keep')} onPress={() => setRelapseDismissed(true)} variant="ghost" compact />
          </Row>
        </Card>
      ) : null}

      {view.canIncrease && view.nextAmount !== null ? (
        <Card tone="info">
          <Body>{t('practice.increase.title')}</Body>
          <Body muted>{t('practice.increase.body', { amount: amountLabel(view.nextAmount) })}</Body>
          <Button label={t('practice.increase.action')} onPress={() => update((p) => increase(normalize(p, d), d))} compact />
        </Card>
      ) : null}

      <SectionTitle>{t('practice.plan.settings')}</SectionTitle>
      <Card>
        <Body>{t('practice.add.slots')}</Body>
        <SlotsEditor slots={slots} onChange={setSlots} />
      </Card>
      <Card>
        <Body>{t('practice.add.activeDays')}</Body>
        <ActiveDaysPicker value={activeDays} onChange={setActiveDays} />
      </Card>
      {weekdays ? (
        <Card>
          <Body>{t('practice.add.reminderDays')}</Body>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
        </Card>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={saved ? t('practice.plan.saved') : t('practice.plan.save')} onPress={saveSettings} />

      <EvidenceList
        ids={habit?.evidence}
        byId={evidence.data}
        loading={evidence.isLoading}
        error={evidence.isError}
      />

      <Button label={t('practice.plan.delete')} onPress={remove} variant="danger" />
    </Screen>
  );
}
