/**
 * «أعِنّي على طاعة»: add a habit plan in four short steps, after the website's setup (option cards, a step marker,
 * «التالي» with a forward arrow, «رجوع» as an outline button):
 * 1. choose a habit from the catalog (habits already in the list open their plan);
 * 2. the distance question (far/near) → a very small start amount;
 * 3. reminder slots (≥ 2 suggested) and active days per week (3 at the beginning) + reminder weekdays;
 * 4. «فروضي وأدواري»: the free time check (practice-core `dailyLoad` / `loadWarning` for today, ebb and season
 *    aware, as on the duties screen), then create. Adding the first habit asks for the notification permission
 *    when habit reminders are on (the default); on a «يومي ثقيل» day the new habit is lightened too.
 * Optional param `habit` preselects a habit (e.g. an alternative from the sin program).
 * The system Back (Android button, iOS swipe, header) goes one step back inside the wizard, so no input is lost;
 * from the step the wizard opened on it leaves. «التالي» and «رجوع» stay pinned under the step, above the safe area.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, HardDrive, Hourglass } from 'lucide-react-native';
import {
  dailyLoad,
  loadWarning,
  startEbb,
  startSuggestion,
  upsertPlan,
  validatePlan,
  type LocalDate,
  type LocalTime,
  type Plan,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick, type CatalogHabit, type UiLocale } from '@/lib/practice/catalog-types';
import { ruleToWeekdays, sortSlots, weekdaysToRule } from '@/lib/practice/format';
import { ensurePermission } from '@/lib/practice/notifications';
import { heavyDayOn, planFromHabit, startAmount, type Distance } from '@/lib/practice/plan-view';
import { shouldAskOnFirstHabit } from '@/lib/practice/prefs';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount } from '@/lib/practice/reminders';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ActiveDaysPicker, SlotsEditor, WeekdayPicker } from '@/components/practice/editors';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import {
  Button,
  CheckRow,
  ErrorState,
  ErrorText,
  ListRow,
  NextStep,
  Notice,
  PageHeader,
  Rule,
  Section,
  Skeleton,
  Text,
  Wrap,
  Screen,
} from '@/ui';

type Step = 'choose' | 'distance' | 'schedule' | 'load';

const STEPS: Step[] = ['choose', 'distance', 'schedule', 'load'];
const DISTANCES: Distance[] = ['far', 'near'];
const SKELETON_OPTIONS = ['a', 'b', 'c', 'd'];
/** Navigation actions that mean «back» (hardware button, swipe, header): inside the wizard they go one step back. */
const BACK_ACTIONS = new Set(['GO_BACK', 'POP']);

const makeStyles = (t: Theme) => ({
  group: { gap: space.md },
  stepHeader: { gap: space.sm },
  progress: { flexDirection: 'row' as const, gap: 6 },
  segment: { flex: 1, height: 3, borderRadius: radius.full, backgroundColor: t.colors.border },
  segmentDone: { backgroundColor: t.colors.primary },
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['2xl'], gap: space['2xl'] },
  footer: {
    paddingHorizontal: GUTTER,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  actions: { gap: space.md },
});

export default function AddHabitScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const params = useLocalSearchParams<{ habit?: string }>();
  const catalog = usePracticeCatalog(locale);
  const plans = usePracticeStore((s) => s.store.plans);
  const free = usePracticeStore((s) => s.store.settings.freeMinutesPerDay ?? null);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const navigation = useNavigation();

  const entryStep: Step = params.habit ? 'distance' : 'choose';
  const [habitKey, setHabitKey] = useState<string | null>(params.habit ?? null);
  const [step, setStep] = useState<Step>(entryStep);
  const [distance, setDistance] = useState<Distance | null>(null);
  const [slots, setSlots] = useState<LocalTime[]>([]);
  const [activeDays, setActiveDays] = useState(3);
  const [weekdays, setWeekdays] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const habit = useMemo(() => catalog.data?.habits.find((h) => h.key === habitKey), [catalog.data, habitKey]);

  // A preselected habit (route param) gets its catalog defaults once the catalog is there.
  const [initialized, setInitialized] = useState<string | null>(null);
  useEffect(() => {
    if (habit && initialized !== habit.key) {
      setInitialized(habit.key);
      setSlots(sortSlots(habit.defaultSlots));
      setWeekdays(ruleToWeekdays(habit.defaultRule));
    }
  }, [habit, initialized]);

  const stepIndex = STEPS.indexOf(step);
  const canStepBack = stepIndex > STEPS.indexOf(entryStep);
  usePreventRemove(canStepBack, ({ data }) => {
    if (BACK_ACTIONS.has(data.action.type)) {
      setStep(STEPS[stepIndex - 1]);
      return;
    }
    // Leaving on purpose (the plan was created, a link was followed): let it through.
    navigation.dispatch(data.action);
  });

  if (catalog.isLoading) return <ChooseSkeleton />;
  if (catalog.isError || !catalog.data) {
    return (
      <Screen edges={['bottom']} keyboard>
        <ErrorState message={t('practice.catalogError')} onRetry={() => void catalog.refetch()} />
      </Screen>
    );
  }

  // Plan ids are UUIDs; the catalog habit is `habitKey`.
  const planByHabit = new Map(plans.map((p) => [p.habitKey ?? p.id, p.id]));
  const unitFallback = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };
  const amount = habit && distance ? startAmount(habit, distance, startSuggestion) : null;

  function handleSelect(h: CatalogHabit) {
    if (h.key !== habitKey) setDistance(null);
    setHabitKey(h.key);
  }

  function handleCreate() {
    if (!habit || amount === null) return;
    setError(null);
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
    if (validatePlan(plan) !== null) {
      setError(t('practice.add.invalidPlan'));
      return;
    }
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
      <ChooseStep
        habits={catalog.data.habits}
        locale={locale}
        selectedKey={habit && !planByHabit.has(habit.key) ? habit.key : null}
        planByHabit={planByHabit}
        onSelect={handleSelect}
        onNext={() => setStep('distance')}
      />
    );
  }

  const title = pick(habit, 'title', locale);
  const timeHint = pick(habit, 'timeHint', locale);

  if (step === 'distance') {
    return (
      <StepFrame
        step={step}
        eyebrow={title}
        title={t('practice.add.distanceQuestion')}
        lead={t(`practice.basis.${habit.basis}`)}
        nextLabel={t('practice.add.next')}
        onNext={() => setStep('schedule')}
        nextDisabled={amount === null}
        onBack={() => setStep('choose')}
      >
        <View style={styles.group} accessibilityRole="radiogroup">
          {DISTANCES.map((value) => (
            <CheckRow
              key={value}
              radio
              title={t(`practice.add.${value}`)}
              hint={t(`practice.add.${value}Hint`)}
              checked={distance === value}
              onPress={() => setDistance(value)}
            />
          ))}
        </View>
        {amount !== null ? (
          <NextStep title={t('practice.add.startAmount', { amount: formatAmount(amount, habit.unit, habit, locale, unitFallback) })}>
            {t('practice.add.startHint')}
          </NextStep>
        ) : null}
      </StepFrame>
    );
  }

  if (step === 'schedule') {
    return (
      <StepFrame
        step={step}
        eyebrow={title}
        title={t('practice.add.slots')}
        lead={timeHint ? t('practice.add.timeHint', { hint: timeHint }) : undefined}
        nextLabel={t('practice.add.next')}
        onNext={() => setStep('load')}
        nextDisabled={slots.length === 0 || (weekdays !== null && weekdays.length === 0)}
        onBack={() => setStep('distance')}
      >
        <ScheduleFields
          slots={slots}
          onSlots={setSlots}
          activeDays={activeDays}
          onActiveDays={setActiveDays}
          weekdays={weekdays}
          onWeekdays={setWeekdays}
        />
      </StepFrame>
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

  return (
    <StepFrame
      step={step}
      eyebrow={title}
      title={t('practice.add.loadTitle')}
      nextLabel={t('practice.add.create')}
      onNext={handleCreate}
      onBack={() => setStep('schedule')}
    >
      <LoadCheck plans={allPlans} free={free} today={d} />
      {error ? (
        <Notice icon={CircleAlert} tone="destructive">
          {error}
        </Notice>
      ) : null}
    </StepFrame>
  );
}

interface StepFrameProps {
  step: Step;
  eyebrow?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  onBack?: () => void;
}

/** One step: the progress marker, the step's title block and its fields scroll; «التالي» and «رجوع» stay pinned. */
function StepFrame({ step, eyebrow, title, lead, children, nextLabel, onNext, nextDisabled, onBack }: StepFrameProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen edges={['bottom']} keyboard scroll={false} contentStyle={styles.frame}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <StepProgress step={step} />
        <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
        {children}
      </ScrollView>
      <View style={styles.footer}>
        <Wrap style={styles.actions}>
          <Button label={nextLabel} onPress={onNext} disabled={nextDisabled} large arrow />
          {onBack ? <Button label={t('practice.add.back')} onPress={onBack} variant="outline" large /> : null}
        </Wrap>
      </View>
    </Screen>
  );
}

/** Four hairline segments; the steps reached so far in the primary colour. */
function StepProgress({ step }: { step: Step }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const index = STEPS.indexOf(step);
  return (
    <View style={styles.stepHeader}>
      <Text variant="eyebrow">{t('practice.add.stepOf', { step: String(index + 1), total: String(STEPS.length) })}</Text>
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: STEPS.length, now: index + 1 }}
      >
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.segment, i <= index && styles.segmentDone]} />
        ))}
      </View>
    </View>
  );
}

interface ChooseStepProps {
  habits: readonly CatalogHabit[];
  locale: UiLocale;
  selectedKey: string | null;
  planByHabit: Map<string, string>;
  onSelect: (habit: CatalogHabit) => void;
  onNext: () => void;
}

function ChooseStep({ habits, locale, selectedKey, planByHabit, onSelect, onNext }: ChooseStepProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const available = habits.filter((h) => !planByHabit.has(h.key));
  const added = habits.filter((h) => planByHabit.has(h.key));
  return (
    <StepFrame
      step="choose"
      eyebrow={t('practice.add.title')}
      title={t('practice.add.chooseHabit')}
      lead={t('practice.noPlansHint')}
      nextLabel={t('practice.add.next')}
      onNext={onNext}
      nextDisabled={selectedKey === null}
    >
      <Notice icon={HardDrive}>{t('practice.privateNote')}</Notice>
      {available.length > 0 ? (
        <View style={styles.group} accessibilityRole="radiogroup">
          {available.map((h) => (
            <CheckRow
              key={h.key}
              radio
              title={pick(h, 'title', locale)}
              hint={pick(h, 'timeHint', locale) || t(`practice.basis.${h.basis}`)}
              checked={selectedKey === h.key}
              onPress={() => onSelect(h)}
            />
          ))}
        </View>
      ) : null}
      {added.length > 0 ? (
        <Section title={t('practice.add.alreadyAdded')}>
          <View>
            {added.map((h) => (
              <ListRow
                key={h.key}
                title={pick(h, 'title', locale)}
                chevron
                onPress={() => {
                  const id = planByHabit.get(h.key);
                  if (id) router.replace(`/practice/plan/${id}`);
                }}
              />
            ))}
          </View>
        </Section>
      ) : null}
    </StepFrame>
  );
}

interface ScheduleFieldsProps {
  slots: LocalTime[];
  onSlots: (slots: LocalTime[]) => void;
  activeDays: number;
  onActiveDays: (n: number) => void;
  weekdays: number[] | null;
  onWeekdays: (days: number[]) => void;
}

function ScheduleFields({ slots, onSlots, activeDays, onActiveDays, weekdays, onWeekdays }: ScheduleFieldsProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <>
      <SlotsEditor slots={slots} onChange={onSlots} />
      <Rule />
      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('practice.add.activeDays')}
        </Text>
        <ActiveDaysPicker value={activeDays} onChange={onActiveDays} />
      </View>
      {weekdays ? (
        <>
          <Rule />
          <View style={styles.group}>
            <Text variant="heading" accessibilityRole="header">
              {t('practice.add.reminderDays')}
            </Text>
            <WeekdayPicker value={weekdays} onChange={onWeekdays} />
            {weekdays.length === 0 ? <ErrorText>{t('practice.add.noReminderDays')}</ErrorText> : null}
          </View>
        </>
      ) : null}
    </>
  );
}

/**
 * «فروضي وأدواري» before creating: free time not set yet → a way to set it; else the load and its verdict, for today
 * (practice-core `dailyLoad` / `loadWarning`, ebb and season aware), as on the duties screen.
 */
function LoadCheck({ plans, free, today: d }: { plans: readonly Plan[]; free: number | null; today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  if (free === null) {
    return (
      <View style={styles.group}>
        <Notice icon={Hourglass}>{t('practice.duties.notSet')}</Notice>
        <Button label={t('practice.add.loadSetup')} onPress={() => router.push('/practice/duties')} variant="outline" arrow />
      </View>
    );
  }
  const load = dailyLoad(plans, d);
  const over = loadWarning(plans, free, d) === 'over';
  return (
    <View style={styles.group}>
      <Text variant="body">{t('practice.duties.load', { load: String(load), free: String(free) })}</Text>
      {over ? <NextStep>{t('practice.duties.over')}</NextStep> : <Notice icon={CircleCheck}>{t('practice.duties.ok')}</Notice>}
    </View>
  );
}

/** The shape of the habit list while the catalog loads. */
function ChooseSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen edges={['bottom']} keyboard>
      <StepProgress step="choose" />
      <View style={styles.group} accessibilityLabel={t('common.loading')}>
        <Skeleton width="35%" height={14} />
        <Skeleton width="80%" height={30} />
        <Skeleton width="60%" height={14} />
      </View>
      <View style={styles.group}>
        {SKELETON_OPTIONS.map((key) => (
          <Skeleton key={key} height={76} />
        ))}
      </View>
    </Screen>
  );
}
