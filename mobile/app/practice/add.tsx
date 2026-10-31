/**
 * Adding a habit in three short screens (redesign §4.5), the first habit and every later one alike, after the website's
 * stepper: «ماذا؟» (the habit), «متى؟» (reminder slots, active days per week, reminder weekdays), «كم؟» (far/near → a
 * very small start, with the «فروضي وأدواري» load check). Each screen has one hint line, one example and «تخطَّ», which
 * keeps the defaults (the suggested habit, the catalog's slots, the «far» start); progress dots on top. After the
 * FIRST habit only: the two switches «نية اليوم» and «المحاسبة المسائية» (opt-in) and, once, «حلقة العادة» and
 * «الاستمرار: ثلاث حقائق». Adding the first habit asks for the notification permission when habit reminders are on
 * (the default); on a «يومي ثقيل» day the new habit is lightened too.
 * Optional param `habit` preselects a habit (e.g. a good deed's «اجعلها عادتي») and opens on «متى؟».
 * The system Back goes one step back inside the stepper, so no input is lost; from the step it opened on it leaves.
 * «التالي», «تخطَّ» and «رجوع» stay pinned under the step, above the safe area.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { LimitSheet } from '@/components/practice/LimitSheet';
import { useLimits } from '@/lib/practice/use-habits-hub';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, HardDrive, Hourglass } from 'lucide-react-native';
import {
  dailyLoad,
  defaultHabitKey,
  loadWarning,
  ONBOARDING_STEPS,
  setHeartPrefs,
  startEbb,
  startSuggestion,
  upsertPlan,
  validatePlan,
  type LocalDate,
  type LocalTime,
  type OnboardingStep,
  type Plan,
} from '@thekra/practice-core';
import { ConsistencyCard, HabitLoopCard, StoryLine } from '@/components/practice/hub/KnowledgeCards';
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
  SwitchRow,
  Text,
  Wrap,
  Screen,
} from '@/ui';

type Step = OnboardingStep | 'finish';

const STEPS: readonly OnboardingStep[] = ONBOARDING_STEPS;
const DISTANCES: Distance[] = ['far', 'near'];
const SKELETON_OPTIONS = ['a', 'b', 'c', 'd'];
/** Navigation actions that mean «back» (hardware button, swipe, header): inside the wizard they go one step back. */
const BACK_ACTIONS = new Set(['GO_BACK', 'POP']);

const makeStyles = (t: Theme) => ({
  group: { gap: space.md },
  stepHeader: { gap: space.sm },
  progress: { flexDirection: 'row' as const, gap: 8 },
  segment: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: t.colors.border },
  segmentDone: { backgroundColor: t.colors.primary },
  intro: { gap: space.xs },
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
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const setStore = usePracticeStore((s) => s.setStore);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const navigation = useNavigation();

  const entryStep: Step = params.habit ? 'when' : 'what';
  const [habitKey, setHabitKey] = useState<string | null>(params.habit ?? null);
  const [step, setStep] = useState<Step>(entryStep);
  const [distance, setDistance] = useState<Distance>('far');
  const [slots, setSlots] = useState<LocalTime[]>([]);
  const [activeDays, setActiveDays] = useState(3);
  const [weekdays, setWeekdays] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The first habit's id once saved: its last screen («نية اليوم», «المحاسبة المسائية») opens it when done.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [firstHabit] = useState(() => usePracticeStore.getState().store.plans.length === 0);

  const habit = useMemo(() => catalog.data?.habits.find((h) => h.key === habitKey), [catalog.data, habitKey]);
  // Limits (redesign §3): a periodic template falls under the 7 periodic acts, anything else under the 3 saplings.
  const planLimits = useLimits();
  const preselected = catalog.data?.habits.find((h) => h.key === params.habit);
  const limitKind = preselected?.kind === 'periodic' ? 'periodic' : 'sapling';
  const limitReached = Boolean(catalog.data) && plans.length > 0 && createdId === null && !planLimits.canAdd(limitKind);
  // A people template (a good-deed page's «اجعلها عادتي») adds people on its list, not a plan.
  const peopleCircle = preselected?.people;
  useEffect(() => {
    if (peopleCircle) router.replace({ pathname: '/practice/kinship', params: { circle: peopleCircle } });
  }, [peopleCircle]);

  // A chosen habit gets its catalog defaults (slots, reminder weekdays) once.
  const [initialized, setInitialized] = useState<string | null>(null);
  useEffect(() => {
    if (habit && initialized !== habit.key) {
      setInitialized(habit.key);
      setSlots(sortSlots(habit.defaultSlots));
      setWeekdays(ruleToWeekdays(habit.defaultRule));
    }
  }, [habit, initialized]);

  const stepIndex = step === 'finish' ? STEPS.length : STEPS.indexOf(step);
  const canStepBack = step !== 'finish' && stepIndex > STEPS.indexOf(entryStep as OnboardingStep);
  usePreventRemove(canStepBack, ({ data }) => {
    if (BACK_ACTIONS.has(data.action.type)) {
      setStep(STEPS[stepIndex - 1] ?? 'what');
      return;
    }
    // Leaving on purpose (the plan was created, a link was followed): let it through.
    navigation.dispatch(data.action);
  });

  if (limitReached) {
    return (
      <>
        <ChooseSkeleton />
        <LimitSheet kind={limitKind} visible limits={planLimits} onClose={() => router.back()} onFreed={() => undefined} />
      </>
    );
  }
  if (catalog.isLoading) return <ChooseSkeleton />;
  if (catalog.isError || !catalog.data) {
    return (
      <Screen edges={['bottom']} keyboard>
        <ErrorState message={t('practice.catalogError')} onRetry={() => void catalog.refetch()} />
      </Screen>
    );
  }

  if (step === 'finish') {
    const done = () => {
      setHeart((h) => setHeartPrefs(h, { cardsSeen: true }));
      router.replace(createdId ? `/practice/plan/${createdId}` : '/habits');
    };
    return (
      <StepFrame step="finish" title={t('practice.onboarding.finishTitle')} lead={t('practice.onboarding.finishLead')} nextLabel={t('practice.onboarding.done')} onNext={done}>
        <SwitchRow
          label={t('practice.onboarding.intention')}
          hint={t('practice.onboarding.intentionHint')}
          value={heart.prefs.intention}
          onValueChange={(on) => setHeart((h) => setHeartPrefs(h, { intention: on }))}
        />
        <SwitchRow
          label={t('practice.onboarding.evening')}
          hint={t('practice.onboarding.eveningHint')}
          value={heart.prefs.eveningReview}
          onValueChange={(on) => setHeart((h) => setHeartPrefs(h, { eveningReview: on }))}
        />
        {!heart.prefs.cardsSeen ? (
          <View style={styles.group}>
            <HabitLoopCard />
            <ConsistencyCard />
          </View>
        ) : null}
      </StepFrame>
    );
  }

  // Plan ids are UUIDs; the catalog habit is `habitKey`.
  const planByHabit = new Map(plans.map((p) => [p.habitKey ?? p.id, p.id]));
  const unitFallback = {
    minutes: t('practice.units.minutes'),
    count: t('practice.units.count'),
    times: t('practice.units.times'),
  };
  const offered = catalog.data.habits.filter((h) => !h.people && (h.kind !== 'periodic' || h.key === params.habit));

  function handleSelect(key: string) {
    setHabitKey(key);
    setError(null);
  }

  function create(choice: { distance: Distance; slots: LocalTime[]; weekdays: number[] | null }) {
    if (!habit) return;
    setError(null);
    const amount = startAmount(habit, choice.distance, startSuggestion);
    if (choice.slots.length === 0) {
      setError(t('practice.add.noSlots'));
      return;
    }
    const rule = choice.weekdays ? weekdaysToRule(choice.weekdays) : habit.defaultRule;
    if (!rule) {
      setError(t('practice.add.noReminderDays'));
      return;
    }
    const d = today();
    let plan = planFromHabit({ id: newPracticeId(), habit, amount, slots: choice.slots, activeDaysPerWeek: activeDays, rule, today: d, locale });
    if (validatePlan(plan) !== null) {
      setError(t('practice.add.invalidPlan'));
      return;
    }
    const { store, prefs } = usePracticeStore.getState();
    // «يومي ثقيل» is on for every habit today: the new one joins it, so the switch does not flip off.
    if (heavyDayOn(store.plans, d)) plan = startEbb(plan, d);
    const askPermission = shouldAskOnFirstHabit(store.plans.length, prefs);
    setStore((s) => upsertPlan(s, plan));
    if (askPermission) void askForReminders();
    if (firstHabit) {
      setCreatedId(plan.id);
      setStep('finish');
    } else {
      router.replace(`/practice/plan/${plan.id}`);
    }
  }

  // The reminder times just chosen only work with the permission; asked once, when the first habit is added.
  async function askForReminders() {
    if (await ensurePermission(t('practice.notify.channelName'))) return;
    // Denied: the switch must not claim reminders that cannot arrive. Turning it on later asks again.
    setPrefs((p) => ({ ...p, habitReminders: false }));
    Alert.alert(t('practice.permissionDenied'));
  }

  if (step === 'what' || !habit) {
    return (
      <ChooseStep
        habits={offered}
        locale={locale}
        selectedKey={habit && !planByHabit.has(habit.key) ? habit.key : null}
        planByHabit={planByHabit}
        showStory={firstHabit}
        error={error}
        onSelect={handleSelect}
        onNext={() => (habitKey ? setStep('when') : setError(t('practice.add.chooseHabit')))}
        onSkip={() => {
          const key = habitKey ?? defaultHabitKey(offered.filter((h) => !planByHabit.has(h.key)).map((h) => h.key));
          if (!key) return;
          handleSelect(key);
          setStep('when');
        }}
      />
    );
  }

  const title = pick(habit, 'title', locale);

  if (step === 'when') {
    return (
      <StepFrame
        step={step}
        eyebrow={title}
        title={t('practice.onboarding.when.title')}
        lead={t('practice.onboarding.when.hint')}
        example={t('practice.onboarding.when.example')}
        nextLabel={t('practice.add.next')}
        onNext={() => setStep('howMuch')}
        nextDisabled={slots.length === 0 || (weekdays !== null && weekdays.length === 0)}
        onSkip={() => {
          setSlots(sortSlots(habit.defaultSlots));
          setWeekdays(ruleToWeekdays(habit.defaultRule));
          setActiveDays(3);
          setStep('howMuch');
        }}
        onBack={entryStep === 'when' ? undefined : () => setStep('what')}
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

  // step === 'howMuch': far/near → the start amount, and the «فروضي وأدواري» check with the new plan included.
  const amount = startAmount(habit, distance, startSuggestion);
  const d = today();
  const preview = planFromHabit({ id: 'preview', habit, amount, slots, activeDaysPerWeek: activeDays, rule: habit.defaultRule, today: d, locale });
  const allPlans = [...plans, heavyDayOn(plans, d) ? startEbb(preview, d) : preview];

  return (
    <StepFrame
      step={step}
      eyebrow={title}
      title={t('practice.onboarding.howMuch.title')}
      lead={t('practice.onboarding.howMuch.hint')}
      example={t('practice.onboarding.howMuch.example')}
      nextLabel={t('practice.add.create')}
      onNext={() => create({ distance, slots, weekdays })}
      onSkip={() =>
        create({ distance: 'far', slots: slots.length > 0 ? slots : sortSlots(habit.defaultSlots), weekdays: weekdays ?? ruleToWeekdays(habit.defaultRule) })
      }
      onBack={() => setStep('when')}
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
      <NextStep title={t('practice.add.startAmount', { amount: formatAmount(amount, habit.unit, habit, locale, unitFallback) })}>
        {t('practice.add.startHint')}
      </NextStep>
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
  /** One example line under the hint. */
  example?: string;
  children: React.ReactNode;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  /** «تخطَّ»: keep the defaults of this screen and go on. */
  onSkip?: () => void;
  onBack?: () => void;
}

/** One screen: the dots, the question with ONE hint line and one example; «التالي», «تخطَّ» and «رجوع» stay pinned. */
function StepFrame({ step, eyebrow, title, lead, example, children, nextLabel, onNext, nextDisabled, onSkip, onBack }: StepFrameProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen edges={['bottom']} keyboard scroll={false} contentStyle={styles.frame}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <StepProgress step={step} />
        <View style={styles.intro}>
          <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
          {example ? (
            <Text variant="small" tone="muted">
              {example}
            </Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
      <View style={styles.footer}>
        <Wrap style={styles.actions}>
          <Button label={nextLabel} onPress={onNext} disabled={nextDisabled} large arrow />
          {onSkip ? <Button label={t('practice.onboarding.skip')} onPress={onSkip} variant="outline" large /> : null}
          {onBack ? <Button label={t('practice.add.back')} onPress={onBack} variant="ghost" large /> : null}
        </Wrap>
      </View>
    </Screen>
  );
}

/** Three dots; the steps reached so far in the primary colour. */
function StepProgress({ step }: { step: Step }) {
  const styles = useStyles(makeStyles);
  const { t } = useTranslation();
  const index = step === 'finish' ? STEPS.length - 1 : STEPS.indexOf(step);
  return (
    <View style={styles.stepHeader}>
      <Text variant="eyebrow">{t('practice.onboarding.stepOf', { step: String(index + 1) })}</Text>
      <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: STEPS.length, now: index + 1 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.segment, (i <= index || step === 'finish') && styles.segmentDone]} />
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
  showStory: boolean;
  error: string | null;
  onSelect: (key: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

function ChooseStep({ habits, locale, selectedKey, planByHabit, showStory, error, onSelect, onNext, onSkip }: ChooseStepProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const available = habits.filter((h) => !planByHabit.has(h.key));
  const added = habits.filter((h) => planByHabit.has(h.key));
  return (
    <StepFrame
      step="what"
      eyebrow={t('practice.add.title')}
      title={t('practice.onboarding.what.title')}
      lead={t('practice.onboarding.what.hint')}
      example={t('practice.onboarding.what.example')}
      nextLabel={t('practice.add.next')}
      onNext={onNext}
      nextDisabled={selectedKey === null}
      onSkip={available.length > 0 ? onSkip : undefined}
    >
      {showStory ? <StoryLine moment="lateStart" /> : null}
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
              onPress={() => onSelect(h.key)}
            />
          ))}
        </View>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
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
      <StepProgress step="what" />
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
