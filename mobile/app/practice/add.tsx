/**
 * «أعِنّي على طاعة» — add a habit plan in four short steps:
 * 1. choose a habit from the catalog;
 * 2. the distance question (far/near) → a very small start amount;
 * 3. reminder slots (≥ 2 suggested) and active days per week (3 at the beginning) + reminder weekdays;
 * 4. «فروضي وأدواري»: the free time check (practice-core `dailyLoad` / `loadWarning` for today, ebb and season
 *    aware, as on the duties screen), then create. Adding the first habit asks for the notification permission
 *    when habit reminders are on (the default); on a «يومي ثقيل» day the new habit is lightened too.
 * Optional param `habit` preselects a habit (e.g. an alternative from the sin program).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { dailyLoad, loadWarning, startEbb, startSuggestion, upsertPlan, validatePlan, type LocalTime } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick, type CatalogHabit } from '@/lib/practice/catalog-types';
import { ruleToWeekdays, sortSlots, weekdaysToRule } from '@/lib/practice/format';
import { ensurePermission } from '@/lib/practice/notifications';
import { heavyDayOn, planFromHabit, startAmount, type Distance } from '@/lib/practice/plan-view';
import { shouldAskOnFirstHabit } from '@/lib/practice/prefs';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ErrorState } from '@/components/ErrorState';
import { ActiveDaysPicker, SlotsEditor, WeekdayPicker } from '@/components/practice/editors';
import {
  Body,
  Button,
  Card,
  Chip,
  ErrorText,
  LinkRow,
  Loading,
  Row,
  Screen,
  SectionTitle,
  Wrap,
} from '@/components/practice/ui';

type Step = 'choose' | 'distance' | 'schedule' | 'load';

export default function AddHabitScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const params = useLocalSearchParams<{ habit?: string }>();
  const catalog = usePracticeCatalog(locale);
  const plans = usePracticeStore((s) => s.store.plans);
  const free = usePracticeStore((s) => s.store.settings.freeMinutesPerDay ?? null);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);

  const [habitKey, setHabitKey] = useState<string | null>(params.habit ?? null);
  const [step, setStep] = useState<Step>(params.habit ? 'distance' : 'choose');
  const [distance, setDistance] = useState<Distance | null>(null);
  const [slots, setSlots] = useState<LocalTime[]>([]);
  const [activeDays, setActiveDays] = useState(3);
  const [weekdays, setWeekdays] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const habit = useMemo(
    () => catalog.data?.habits.find((h) => h.key === habitKey),
    [catalog.data, habitKey],
  );

  // A preselected habit (route param) gets its catalog defaults once the catalog is there.
  const [initialized, setInitialized] = useState<string | null>(null);
  useEffect(() => {
    if (habit && initialized !== habit.key) {
      setInitialized(habit.key);
      setSlots(sortSlots(habit.defaultSlots));
      setWeekdays(ruleToWeekdays(habit.defaultRule));
    }
  }, [habit, initialized]);

  if (catalog.isLoading) return <Loading />;
  if (catalog.isError || !catalog.data) {
    return <ErrorState message={t('practice.catalogError')} onRetry={() => void catalog.refetch()} />;
  }

  // Plan ids are UUIDs; the catalog habit is `habitKey`.
  const planByHabit = new Map(plans.map((p) => [p.habitKey ?? p.id, p.id]));
  const unitFallback = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };

  function choose(h: CatalogHabit) {
    setHabitKey(h.key);
    setDistance(null);
    setStep('distance');
  }


  const amount = habit && distance ? startAmount(habit, distance, startSuggestion) : null;

  function create() {
    if (!habit || amount === null) return;
    if (slots.length === 0) {
      setError(t('practice.add.noSlots'));
      return;
    }
    const rule = weekdays ? weekdaysToRule(weekdays) : habit.defaultRule;
    if (!rule) {
      setError(t('practice.add.noReminderDays'));
      return;
    }
    const d = today();
    let plan = planFromHabit({ id: newPracticeId(), habit, amount, slots, activeDaysPerWeek: activeDays, rule, today: d, locale });
    if (validatePlan(plan) !== null) return;
    const { store, prefs } = usePracticeStore.getState();
    // «يومي ثقيل» is on for every habit today: the new one joins it, so the switch does not flip off.
    if (heavyDayOn(store.plans, d)) plan = startEbb(plan, d);
    const askPermission = shouldAskOnFirstHabit(store.plans.length, prefs);
    setStore((s) => upsertPlan(s, plan));
    router.replace(`/practice/plan/${plan.id}`);
    if (askPermission) void askForReminders();
  }

  // The reminder times just chosen only work with the permission; asked once, when the first habit is added.
  async function askForReminders() {
    if (await ensurePermission(t('practice.notify.channelName'))) return;
    // Denied: the switch must not claim reminders that cannot arrive. Turning it on later asks again.
    setPrefs((p) => ({ ...p, habitReminders: false }));
    Alert.alert(t('practice.permissionDenied'));
  }

  if (step === 'choose' || !habit) {
    return (
      <Screen>
        <SectionTitle>{t('practice.add.chooseHabit')}</SectionTitle>
        <Card>
          {catalog.data.habits.map((h) => (
            <LinkRow
              key={h.key}
              label={pick(h, 'title', locale)}
              hint={planByHabit.has(h.key) ? t('practice.add.alreadyAdded') : t(`practice.basis.${h.basis}`)}
              onPress={() => {
                const id = planByHabit.get(h.key);
                if (id) router.replace(`/practice/plan/${id}`);
                else choose(h);
              }}
            />
          ))}
        </Card>
      </Screen>
    );
  }

  const title = pick(habit, 'title', locale);
  const timeHint = pick(habit, 'timeHint', locale);

  if (step === 'distance') {
    return (
      <Screen>
        <SectionTitle>{title}</SectionTitle>
        <Body muted small>
          {t(`practice.basis.${habit.basis}`)}
        </Body>
        <Card>
          <Body>{t('practice.add.distanceQuestion')}</Body>
          <Wrap>
            <Chip label={`${t('practice.add.far')} — ${t('practice.add.farHint')}`} selected={distance === 'far'} onPress={() => setDistance('far')} />
            <Chip label={`${t('practice.add.near')} — ${t('practice.add.nearHint')}`} selected={distance === 'near'} onPress={() => setDistance('near')} />
          </Wrap>
          {amount !== null ? (
            <>
              <Body>{t('practice.add.startAmount', { amount: formatAmount(amount, habit.unit, habit, locale, unitFallback) })}</Body>
              <Body muted small>
                {t('practice.add.startHint')}
              </Body>
            </>
          ) : null}
        </Card>
        <Row>
          <Button label={t('practice.add.back')} onPress={() => setStep('choose')} variant="ghost" />
          <Button label={t('practice.add.next')} onPress={() => setStep('schedule')} disabled={amount === null} />
        </Row>
      </Screen>
    );
  }

  if (step === 'schedule') {
    return (
      <Screen>
        <SectionTitle>{title}</SectionTitle>
        {timeHint ? <Body muted small>{t('practice.add.timeHint', { hint: timeHint })}</Body> : null}
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
            {weekdays.length === 0 ? <ErrorText>{t('practice.add.noReminderDays')}</ErrorText> : null}
          </Card>
        ) : null}
        <Row>
          <Button label={t('practice.add.back')} onPress={() => setStep('distance')} variant="ghost" />
          <Button
            label={t('practice.add.next')}
            onPress={() => setStep('load')}
            disabled={slots.length === 0 || (weekdays !== null && weekdays.length === 0)}
          />
        </Row>
      </Screen>
    );
  }

  // step === 'load': «فروضي وأدواري» check with the new plan included, for today (ebb and season aware), with the
  // same practice-core functions as the duties screen.
  const d = today();
  const preview =
    amount !== null
      ? planFromHabit({ id: 'preview', habit, amount, slots, activeDaysPerWeek: activeDays, rule: habit.defaultRule, today: d, locale })
      : null;
  const allPlans = preview ? [...plans, heavyDayOn(plans, d) ? startEbb(preview, d) : preview] : plans;
  const load = dailyLoad(allPlans, d);
  const warning = free !== null ? loadWarning(allPlans, free, d) : null;

  return (
    <Screen>
      <SectionTitle>{t('practice.add.loadTitle')}</SectionTitle>
      <Card tone={warning === 'over' ? 'warning' : 'default'}>
        {free === null ? (
          <>
            <Body>{t('practice.duties.notSet')}</Body>
            <Button label={t('practice.add.loadSetup')} onPress={() => router.push('/practice/duties')} variant="outline" compact />
          </>
        ) : (
          <>
            <Body>{t('practice.duties.load', { load: String(load), free: String(free) })}</Body>
            <Body>{warning === 'over' ? t('practice.duties.over') : t('practice.duties.ok')}</Body>
          </>
        )}
      </Card>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Row>
        <Button label={t('practice.add.back')} onPress={() => setStep('schedule')} variant="ghost" />
        <Button label={t('practice.add.create')} onPress={create} />
      </Row>
    </Screen>
  );
}
