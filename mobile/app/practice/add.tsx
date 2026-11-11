/**
 * Adding a habit (owner round 6, C-02f c + C-01d + C-02c; the reference's step indicator, our kit): three steps and a
 * review before saving, the first habit and every later one alike:
 * 1. «العادة»: the catalog's habits (one hint line, one example);
 * 2. «القدر والوقت» (lead: «ابدأ صغيرًا جدًا، وداوم عليه، ولا تزد إلا بعد ثبات.», moved here from the topic pages, C-12): the reminder times and days (the count per week follows the days, A-13 a), far/near → a very
 *    small start, the optional «القدر الأدنى», the two loop questions (optional), and the load check (F-28 a);
 * 3. «رسالة إلى نفسك»: optional and skippable — one line to read on a hard day (practice-core `addSelfMessage`, tied to
 *    the habit; editable later from «رسائلي إلى نفسي», at most 10);
 * 4. «المراجعة»: what will be saved, the first habit's two switches (نية اليوم، المحاسبة المسائية), and «احفظ العادة».
 * With 3 habits already, «أضف» opens the choice «أرشِف واحدة أو احذفها» (with the 3-day note) instead; a periodic
 * template past its 7 shows the periodic limit sheet. Saving toasts and returns to «اليوم» (to «الأعمال الدورية» for a
 * periodic act). `?habit=` preselects a habit (a good deed's «اجعلها عادتي», a periodic act) and opens on step 2. The
 * system Back goes one step back inside the steps, so no input is lost.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useTranslation } from 'react-i18next';
import { BellOff, CircleAlert, CircleCheck, HardDrive, Lightbulb } from 'lucide-react-native';
import {
  addSelfMessage,
  dailyLoad,
  defaultHabitKey,
  LADDER,
  loadWarning,
  nowIso,
  SELF_MESSAGE_MAX_LENGTH,
  selfMessageError,
  setHeartPrefs,
  setMinimum,
  startEbb,
  startSuggestion,
  updateSettings,
  upsertPlan,
  validatePlan,
  type DeedWindow,
  type LocalDate,
  type LocalTime,
  type Plan,
} from '@thekra/practice-core';
import { LimitSheet } from '@/components/practice/LimitSheet';
import { LoopQuestions } from '@/components/practice/PlanEditSheet';
import { SlotsEditor, WeekdayPicker } from '@/components/practice/editors';
import { HabitAddChoiceSheet } from '@/components/practice/habits/HabitActions';
import { StoryLine } from '@/components/practice/hub/KnowledgeCards';
import { usePracticeCatalog } from '@/lib/api/practice';
import { pick, type CatalogHabit, type UiLocale } from '@/lib/practice/catalog-types';
import { startingSlots } from '@/lib/practice/deed-window';
import { ruleToWeekdays, sortSlots, weekdaysToRule } from '@/lib/practice/format';
import { activeDaysFrom, loopFromAnswers, type LoopAnswers } from '@/lib/practice/habits-view';
import { ensurePermission } from '@/lib/practice/notifications';
import { heavyDayOn, planFromHabit, startAmount, type Distance } from '@/lib/practice/plan-view';
import { currentPrayerDay } from '@/lib/practice/prayer';
import { shouldAskOnFirstHabit } from '@/lib/practice/prefs';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { formatAmount } from '@/lib/practice/reminders';
import { useLimits } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { GUTTER, radius, space, useStyles, type Theme } from '@/theme';
import {
  ButtonPair,
  CheckRow,
  Chip,
  ErrorState,
  ErrorText,
  Field,
  ListRow,
  NextStep,
  Notice,
  PageHeader,
  Screen,
  Section,
  SectionDivider,
  Skeleton,
  SwitchRow,
  Text,
  Wrap,
  confirm,
  toast,
} from '@/ui';

type Step = 'what' | 'amount' | 'message' | 'review';
const ALL_STEPS: readonly Step[] = ['what', 'amount', 'message', 'review'];

function defaultSlotsFor(habit: CatalogHabit): LocalTime[] {
  return sortSlots(startingSlots(habit.defaultSlots, habit.window, currentPrayerDay(today())));
}
const DISTANCES: Distance[] = ['far', 'near'];
const SKELETON_OPTIONS = ['a', 'b', 'c', 'd'];
const BACK_ACTIONS = new Set(['GO_BACK', 'POP']);

const makeStyles = (t: Theme) => ({
  group: { gap: space.md },
  steps: { flexDirection: 'row' as const, alignItems: 'flex-start' as const },
  stepItem: { flex: 1, minWidth: 0, alignItems: 'center' as const, gap: 4 },
  stepNum: { zIndex: 1, width: 28, height: 28, backgroundColor: t.colors.background, borderRadius: radius.full, borderWidth: 1, borderColor: t.colors.controlBorder, alignItems: 'center' as const, justifyContent: 'center' as const },
  stepNumOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  /** One hairline from the first circle's centre to the last one's, behind the circles (the same in both directions). */
  stepLine: { position: 'absolute' as const, top: 14, left: '12.5%' as const, right: '12.5%' as const, height: 1, backgroundColor: t.colors.border },
  intro: { gap: space.xs },
  frame: { paddingHorizontal: 0, paddingTop: 0 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space['2xl'], gap: space['2xl'] },
  footer: { paddingHorizontal: GUTTER, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.background },
  summary: { gap: 2, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
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

  const entryStep: Step = params.habit ? 'amount' : 'what';
  const [habitKey, setHabitKey] = useState<string | null>(params.habit ?? null);
  const [step, setStep] = useState<Step>(entryStep);
  const [distance, setDistance] = useState<Distance>('far');
  // null = the habit's own default times (computed from the habit on every render, so the first render is already valid).
  const [pickedSlots, setSlots] = useState<LocalTime[] | null>(null);
  const [weekdays, setWeekdays] = useState<number[] | null>(null);
  const [answers, setAnswers] = useState<LoopAnswers>({ after: '', ifBlocked: '' });
  const [minimum, setMinimumChoice] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [firstHabit] = useState(() => usePracticeStore.getState().store.plans.length === 0);
  const [intention, setIntention] = useState(heart.prefs.intention);
  const [evening, setEvening] = useState(heart.prefs.eveningReview);

  const habit = useMemo(() => catalog.data?.habits.find((h) => h.key === habitKey), [catalog.data, habitKey]);
  const planLimits = useLimits();
  const preselected = catalog.data?.habits.find((h) => h.key === params.habit);
  const periodic = (habit ?? preselected)?.kind === 'periodic';
  const limitKind = preselected?.kind === 'periodic' ? 'periodic' : 'sapling';
  const leaving = useRef(false);
  const [freed, setFreed] = useState(false);
  const limitReached = Boolean(catalog.data) && plans.length > 0 && !leaving.current && !freed && !planLimits.canAdd(limitKind);
  const peopleCircle = preselected?.people;
  useEffect(() => {
    if (peopleCircle) router.replace({ pathname: '/practice/kinship', params: { circle: peopleCircle } });
  }, [peopleCircle]);

  const slots = useMemo(() => pickedSlots ?? (habit ? defaultSlotsFor(habit) : []), [pickedSlots, habit]);
  const [initialized, setInitialized] = useState<string | null>(null);
  useEffect(() => {
    if (habit && initialized !== habit.key) {
      setInitialized(habit.key);
      setWeekdays(ruleToWeekdays(habit.defaultRule));
      setMinimumChoice(null);
    }
  }, [habit, initialized]);

  // A periodic act has no message step (it is a reminder, not a commitment).
  const steps = periodic ? ALL_STEPS.filter((s) => s !== 'message') : ALL_STEPS;
  const index = steps.indexOf(step);
  const canStepBack = index > steps.indexOf(entryStep);
  // Set once the habit is saved: the back-step guard is lifted first, then the screen leaves (a navigation dispatched
  // while the guard is on would be held by it).
  const [leaveTo, setLeaveTo] = useState<'/habits?tab=today' | '/habits?tab=periodic' | null>(null);
  useEffect(() => {
    if (leaveTo) router.replace(leaveTo);
  }, [leaveTo]);
  usePreventRemove(canStepBack && leaveTo === null, ({ data }) => {
    if (BACK_ACTIONS.has(data.action.type) && !leaving.current) {
      setStep(steps[index - 1] ?? 'what');
      return;
    }
    navigation.dispatch(data.action);
  });

  if (limitReached) {
    return (
      <>
        <ChooseSkeleton />
        {limitKind === 'sapling' ? (
          <HabitAddChoiceSheet visible today={today()} onClose={() => router.back()} onFreed={() => setFreed(true)} />
        ) : (
          <LimitSheet kind="periodic" visible limits={planLimits} onClose={() => router.back()} onFreed={() => setFreed(true)} />
        )}
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

  const planByHabit = new Map(plans.map((p) => [p.habitKey ?? p.id, p.id]));
  const unitFallback = { minutes: t('practice.units.minutes'), count: t('practice.units.count'), times: t('practice.units.times') };
  const offered = catalog.data.habits.filter((h) => !h.people && (h.kind !== 'periodic' || h.key === params.habit));
  const next = () => setStep(steps[index + 1] ?? 'review');

  function create() {
    if (!habit) return;
    setError(null);
    const amount = startAmount(habit, distance, startSuggestion);
    if (slots.length === 0) {
      setError(t('practice.add.noSlots'));
      setStep('amount');
      return;
    }
    const rule = weekdays ? weekdaysToRule(weekdays) : habit.defaultRule;
    if (!rule) {
      setError(t('practice.add.noReminderDays'));
      setStep('amount');
      return;
    }
    const d = today();
    const id = newPracticeId();
    let plan = planFromHabit({ id, habit, amount, slots, activeDaysPerWeek: activeDaysFrom(weekdays, 3), rule, today: d, locale });
    const loop = loopFromAnswers(answers, pick(habit, 'title', locale), newPracticeId(), nowIso());
    if (loop) plan = { ...plan, loops: [loop] };
    if (minimum !== null && minimum <= amount) {
      try {
        plan = setMinimum(plan, minimum);
      } catch {
        // an invalid floor is skipped: the plan keeps the default
      }
    }
    if (validatePlan(plan) !== null) {
      setError(t('practice.add.invalidPlan'));
      return;
    }
    const { store, prefs } = usePracticeStore.getState();
    if (heavyDayOn(store.plans, d)) plan = startEbb(plan, d);
    const askPermission = shouldAskOnFirstHabit(store.plans.length, prefs);
    leaving.current = true;
    setStore((s) => upsertPlan(s, plan));
    if (!periodic && message.trim() && !selfMessageError(heart, message)) {
      setHeart((h) => addSelfMessage(h, { id: newPracticeId(), text: message, planId: id }));
    }
    if (firstHabit) setHeart((h) => setHeartPrefs(h, { intention, eveningReview: evening, cardsSeen: true }));
    toast(t('practice.add.addedToast', { habit: pick(habit, 'title', locale) }));
    if (askPermission) void askForReminders();
    setLeaveTo(periodic ? '/habits?tab=periodic' : '/habits?tab=today');
  }

  async function askForReminders() {
    if (await ensurePermission(t('practice.notify.channelName'))) return;
    setPrefs((p) => ({ ...p, habitReminders: false }));
    void confirm({ title: t('practice.permissionDeniedTitle'), message: t('practice.permissionDenied'), confirmLabel: t('common.ok'), cancelLabel: null, icon: BellOff });
  }

  if (step === 'what' || !habit) {
    return (
      <ChooseStep
        steps={steps}
        habits={offered}
        locale={locale}
        selectedKey={habit && !planByHabit.has(habit.key) ? habit.key : null}
        planByHabit={planByHabit}
        showStory={firstHabit}
        error={error}
        onSelect={(key) => {
          setHabitKey(key);
          setSlots(null);
          setError(null);
        }}
        onNext={() => (habitKey ? setStep('amount') : setError(t('practice.add.chooseHabit')))}
        onSkip={() => {
          const key = habitKey ?? defaultHabitKey(offered.filter((h) => !planByHabit.has(h.key)).map((h) => h.key));
          if (!key) return;
          setHabitKey(key);
          setSlots(null);
          setStep('amount');
        }}
      />
    );
  }

  const title = pick(habit, 'title', locale);
  const amount = startAmount(habit, distance, startSuggestion);
  const amountLabel = (n: number) => formatAmount(n, habit.unit, habit, locale, unitFallback);

  if (step === 'amount') {
    const timeHint = pick(habit, 'timeHint', locale);
    const whenExample = timeHint ? t('practice.add.timeHint', { hint: timeHint }) : habit.window ? undefined : t('practice.onboarding.when.example');
    const d = today();
    const preview = planFromHabit({ id: 'preview', habit, amount, slots, activeDaysPerWeek: activeDaysFrom(weekdays, 3), rule: habit.defaultRule, today: d, locale });
    const allPlans = [...plans, heavyDayOn(plans, d) ? startEbb(preview, d) : preview];
    const floors = LADDER.filter((v) => v < amount);
    return (
      <StepFrame
        steps={steps}
        step={step}
        eyebrow={title}
        title={t('habitsHub.add.amountTitle')}
        lead={t('motivations.habitLead')}
        example={whenExample}
        nextLabel={t('practice.add.next')}
        onNext={next}
        nextDisabled={slots.length === 0 || (weekdays !== null && weekdays.length === 0)}
      >
        <StrategyLine strategy="start-tiny" />
        <View style={styles.group} accessibilityRole="radiogroup">
          {DISTANCES.map((value) => (
            <CheckRow key={value} radio title={t(`practice.add.${value}`)} hint={t(`practice.add.${value}Hint`)} checked={distance === value} onPress={() => setDistance(value)} />
          ))}
        </View>
        <NextStep title={t('practice.add.startAmount', { amount: amountLabel(amount) })}>{t('practice.add.startHint')}</NextStep>
        {floors.length > 0 ? (
          <View style={styles.group}>
            <Text variant="heading" accessibilityRole="header">
              {t('habitsHub.add.minimumTitle')}
            </Text>
            <Text variant="small" tone="muted">
              {t('habitsHub.add.minimumHint')}
            </Text>
            <Wrap>
              {floors.map((v) => (
                <Chip key={v} label={amountLabel(v)} selected={minimum === v} onPress={() => setMinimumChoice(minimum === v ? null : v)} />
              ))}
            </Wrap>
          </View>
        ) : null}
        <SectionDivider />
        <StrategyLine strategy="anchor-prayer" />
        <ScheduleFields window={habit.window} slots={slots} onSlots={setSlots} weekdays={weekdays} onWeekdays={setWeekdays} />
        <SectionDivider />
        <View style={styles.group}>
          <Text variant="heading" accessibilityRole="header">
            {t('habitsTab.loop.title')}
          </Text>
          <LoopQuestions value={answers} onChange={setAnswers} />
        </View>
        <LoadCheck plans={allPlans} free={free} today={d} />
        {error ? (
          <Notice icon={CircleAlert} tone="destructive">
            {error}
          </Notice>
        ) : null}
      </StepFrame>
    );
  }

  if (step === 'message') {
    return (
      <StepFrame
        steps={steps}
        step={step}
        eyebrow={title}
        title={t('habitsHub.add.messageTitle')}
        lead={t('habitsHub.add.messageLead')}
        nextLabel={t('practice.add.next')}
        onNext={next}
        onSkip={() => {
          setMessage('');
          next();
        }}
      >
        <Field
          label={t('habitsHub.add.messageLabel')}
          placeholder={t('habitsHub.add.messagePlaceholder')}
          value={message}
          onChangeText={setMessage}
          maxLength={SELF_MESSAGE_MAX_LENGTH}
          multiline
        />
        {selfMessageError(heart, 'x') === 'full' ? <Notice>{t('habitsHub.messages.full')}</Notice> : null}
      </StepFrame>
    );
  }

  // step === 'review'
  const rows = [
    { label: t('habitsHub.add.reviewHabit'), value: title },
    { label: t('habitsHub.add.reviewStart'), value: amountLabel(amount) },
    minimum !== null ? { label: t('habitsHub.minimum.title'), value: amountLabel(minimum) } : null,
    { label: t('habitsHub.add.reviewDays'), value: weekdays ? t('habitsTab.plan.daysPerWeek', { days: t('practice.add.daysCount', { count: weekdays.length }) }) : t('habitsHub.add.reviewDefaultDays') },
    answers.after ? { label: t('habitsTab.loop.after'), value: answers.after } : null,
    answers.ifBlocked ? { label: t('habitsTab.loop.ifBlocked'), value: answers.ifBlocked } : null,
    message.trim() ? { label: t('habitsHub.add.messageLabel'), value: message.trim() } : null,
  ].filter((r): r is { label: string; value: string } => r !== null);
  return (
    <StepFrame steps={steps} step={step} eyebrow={title} title={t('habitsHub.add.reviewTitle')} lead={t('habitsHub.add.reviewLead')} nextLabel={t('habitsHub.add.save')} onNext={create}>
      <View>
        {rows.map((r) => (
          <View key={r.label} style={styles.summary}>
            <Text variant="caption" tone="muted">
              {r.label}
            </Text>
            <Text variant="body">{r.value}</Text>
          </View>
        ))}
      </View>
      {firstHabit && !periodic ? (
        <View style={styles.group}>
          <SwitchRow label={t('practice.onboarding.intention')} hint={t('practice.onboarding.intentionHint')} value={intention} onValueChange={setIntention} />
          <SwitchRow label={t('practice.onboarding.evening')} hint={t('practice.onboarding.eveningHint')} value={evening} onValueChange={setEvening} />
        </View>
      ) : null}
      {error ? (
        <Notice icon={CircleAlert} tone="destructive">
          {error}
        </Notice>
      ) : null}
    </StepFrame>
  );
}

interface StepFrameProps {
  steps: readonly Step[];
  step: Step;
  eyebrow?: string;
  title: string;
  lead?: string;
  example?: string;
  children: React.ReactNode;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  /** «تخطَّ» (only on the optional steps). */
  onSkip?: () => void;
}

function StepFrame({ steps, step, eyebrow, title, lead, example, children, nextLabel, onNext, nextDisabled, onSkip }: StepFrameProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen edges={['bottom']} keyboard scroll={false} contentStyle={styles.frame}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <StepIndicator steps={steps} step={step} />
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
        <ButtonPair
          size="lg"
          primary={{ label: nextLabel, onPress: onNext, disabled: nextDisabled, arrow: step !== 'review' }}
          secondary={onSkip ? { label: t('practice.onboarding.skip'), onPress: onSkip } : null}
        />
      </View>
    </Screen>
  );
}

/** The reference's indicator: numbered circles with each step's name; the current and the done ones filled. */
function StepIndicator({ steps, step }: { steps: readonly Step[]; step: Step }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const index = steps.indexOf(step);
  return (
    <View style={styles.steps} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }} accessibilityLabel={t('habitsHub.add.stepOf', { n: index + 1, total: steps.length })}>
      <View style={[styles.stepLine, { left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }]} />
      {steps.map((s, i) => (
        <View key={s} style={styles.stepItem}>
          <View style={[styles.stepNum, i <= index && styles.stepNumOn]}>
            <Text variant="caption" weight="medium" tone={i <= index ? 'inverse' : 'muted'}>
              {String(i + 1)}
            </Text>
          </View>
          <Text variant="caption" align="center" numberOfLines={1} tone={i === index ? 'default' : 'muted'} weight={i === index ? 'medium' : 'regular'}>
            {t(`habitsHub.add.steps.${s}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface ChooseStepProps {
  steps: readonly Step[];
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

function ChooseStep({ steps, habits, locale, selectedKey, planByHabit, showStory, error, onSelect, onNext, onSkip }: ChooseStepProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const available = habits.filter((h) => !planByHabit.has(h.key));
  const added = habits.filter((h) => planByHabit.has(h.key));
  return (
    <StepFrame
      steps={steps}
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
  window?: DeedWindow;
  slots: LocalTime[];
  onSlots: (slots: LocalTime[]) => void;
  weekdays: number[] | null;
  onWeekdays: (days: number[]) => void;
}

function ScheduleFields({ window, slots, onSlots, weekdays, onWeekdays }: ScheduleFieldsProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <>
      <SlotsEditor slots={slots} onChange={onSlots} window={window} />
      {weekdays ? (
        <View style={styles.group}>
          <Text variant="heading" accessibilityRole="header">
            {t('habitsTab.plan.days')}
          </Text>
          <WeekdayPicker value={weekdays} onChange={onWeekdays} />
          {weekdays.length === 0 ? (
            <ErrorText>{t('practice.add.noReminderDays')}</ErrorText>
          ) : (
            <Text variant="small" tone="muted">
              {t('habitsTab.plan.daysPerWeek', { days: t('practice.add.daysCount', { count: weekdays.length }) })}
            </Text>
          )}
        </View>
      ) : null}
    </>
  );
}

function StrategyLine({ strategy }: { strategy: 'anchor-prayer' | 'start-tiny' }) {
  const { t, i18n } = useTranslation();
  const info = STRATEGY_TITLES[strategy];
  return <Notice icon={Lightbulb}>{`${i18n.language === 'en' ? info.en : info.ar}: ${t(`practice.strategies.items.${strategy}.idea`)}`}</Notice>;
}

const STRATEGY_TITLES = {
  'anchor-prayer': { ar: 'اربطها بصلاة', en: 'Tie it to a prayer' },
  'start-tiny': { ar: 'ابدأ صغيرًا جدًا', en: 'Start very small' },
} as const;

const FREE_CHOICES = [15, 30, 60, 90, 120, 180];

function LoadCheck({ plans, free, today: d }: { plans: readonly Plan[]; free: number | null; today: LocalDate }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const setStore = usePracticeStore((s) => s.setStore);
  const choose = (minutes: number) => {
    setStore((s) => updateSettings(s, { freeMinutesPerDay: minutes }));
    toast(t('habitsTab.add.freeSaved'));
  };
  if (free === null) {
    return (
      <View style={styles.group}>
        <Text variant="heading" accessibilityRole="header">
          {t('habitsTab.add.freeQuestion')}
        </Text>
        <Text variant="small" tone="muted">
          {t('habitsTab.add.freeHint')}
        </Text>
        <Wrap>
          {FREE_CHOICES.map((m) => (
            <Chip key={m} label={t('practice.duties.minutes', { count: m })} onPress={() => choose(m)} />
          ))}
        </Wrap>
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

function ChooseSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Screen edges={['bottom']} keyboard>
      <StepIndicator steps={ALL_STEPS} step="what" />
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
