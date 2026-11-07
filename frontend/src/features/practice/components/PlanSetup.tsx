'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  addHabitLoop,
  defaultHabitKey,
  isPrayerAnchor,
  isValidTime,
  loadWarning,
  MAX_LOOP_TEXT,
  ONBOARDING_STEPS,
  setHeartPrefs,
  startEbb,
  updateSettings,
  upsertPlan,
  type OnboardingStep,
  type Plan,
  type PrayerTimesWithSunrise,
} from '@thekra/practice-core';
import { Switch as KitSwitch } from '@/components/shared/kit/switch';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { formatDigits } from '@/lib/format/digits';
import { updateHeart } from '@/lib/practice/heart-store';
import { updateStore } from '@/lib/practice/local-store';
import { usePrayerTimesToday } from '@/lib/practice/screen-stores';
import { isEbbDay, planFromHabit, type Distance } from '@/lib/practice/plans';
import { ALL_DAYS, planWeekdays, withWeekdays } from '@/lib/practice/days';
import { newUuid } from '@/lib/practice/ids';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { DayChips } from './DayChips';
import { slotProblem, suitableAnchors } from '@/lib/practice/windows';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { useHeart } from '../hooks/useHeart';
import { amountLabel } from './amount-label';
import { ConsistencyCard, HabitLoopCard } from './hub/HabitCards';
import { StoryLine } from './hub/KnowledgeCards';
import { SlotPicker, useWindowRange, WindowLine } from './SlotPicker';

const DISTANCES: Distance[] = ['far', 'near'];

interface PlanSetupProps {
  habits: readonly PracticeHabit[];
  existing: readonly Plan[];
  /** A habit key to start with already chosen (ignored when unknown or already a plan). */
  preselected?: string | null;
  freeMinutes: number | undefined;
  today: string;
  onDone: () => void;
  onCancel?: () => void;
  /** Called just before the first habit is saved, so the parent keeps this setup open for its last screen. */
  onFirstPlan?: () => void;
}

type Step = OnboardingStep | 'finish';

/**
 * Adding a habit in three short screens (redesign §4.5), the first habit and every later one alike: «ماذا؟» (the habit),
 * «متى؟» (two reminder times, the days themselves — A-13 a — and two optional questions, F-13 a: «بعد ماذا ستفعلها؟» and
 * «إذا منعك شيء، فماذا تفعل؟», saved as the habit's loop), «كم؟» (far/near → a very small start, and «كم دقيقة حرة
 * لديك؟» until it is answered, F-28 a). The strategy of each moment is one line in its step (F-12 a: «اربطها بصلاة»,
 * «ابدأ صغيرًا جدًا»). Each screen has one hint line, one example and «تخطَّ», which keeps the defaults; progress dots
 * on top. After the FIRST habit only: the two switches «نية اليوم» and «المحاسبة المسائية» (opt-in) and, once, «حلقة
 * العادة» and «الاستمرار: ثلاث حقائق». A later habit closes the flow with a toast.
 */
export function PlanSetup({ habits, existing, preselected, freeMinutes, today, onDone, onCancel, onFirstPlan }: PlanSetupProps) {
  const t = useTranslations('practice.onboarding');
  const tSetup = useTranslations('practice.setup');
  const english = useLocale() === 'en';
  const heart = useHeart();
  const firstHabit = existing.length === 0;
  const available = habits.filter((habit) => !existing.some((plan) => (plan.habitKey ?? plan.id) === habit.key));
  const preselectedOk = preselected && available.some((habit) => habit.key === preselected) ? preselected : null;
  const [step, setStep] = useState<Step>(preselectedOk ? 'when' : 'what');
  const [habitKey, setHabitKey] = useState<string | null>(preselectedOk);
  const [slots, setSlots] = useState<[string, string]>(() => {
    const chosen = available.find((h) => h.key === preselectedOk);
    return chosen ? [chosen.defaultSlots[0] ?? '08:00', chosen.defaultSlots[1] ?? ''] : ['', ''];
  });
  const [days, setDays] = useState<number[]>(() => {
    const chosen = available.find((h) => h.key === preselectedOk);
    return (chosen && planWeekdays({}, chosen.defaultRule)) || [...ALL_DAYS];
  });
  const [cue, setCue] = useState('');
  const [ifThen, setIfThen] = useState('');
  const [minutes, setMinutes] = useState('');
  const [distance, setDistance] = useState<Distance>('far');
  const [error, setError] = useState<string | null>(null);
  /** «متى؟»: a slot outside the deed's window, per field (0, 1). */
  const [slotErrors, setSlotErrors] = useState<[string | null, string | null]>([null, null]);
  const prayer = usePrayerTimesToday();
  const range = useWindowRange();
  const stepRef = useFocusOnChange<HTMLHeadingElement>(step);
  const tStrategy = useTranslations('practice.strategies');
  const minutesId = useId();
  const habit = available.find((h) => h.key === habitKey);
  const index = step === 'finish' ? ONBOARDING_STEPS.length : ONBOARDING_STEPS.indexOf(step);

  function choose(key: string) {
    const chosen = available.find((h) => h.key === key);
    setHabitKey(key);
    setError(null);
    if (chosen) {
      setSlots([chosen.defaultSlots[0] ?? '08:00', chosen.defaultSlots[1] ?? '']);
      setDays(planWeekdays({}, chosen.defaultRule) ?? [...ALL_DAYS]);
    }
  }

  function goWhen(key: string | null) {
    if (!key) {
      setError(tSetup('errors.chooseOne'));
      return;
    }
    if (key !== habitKey || !slots[0]) choose(key);
    setStep('when');
  }

  function create(choice: { slots: string[]; days: number[]; distance: Distance; withAnswers: boolean }) {
    if (!habit) return;
    let plan = withWeekdays(
      planFromHabit(habit, { distance: choice.distance, slots: choice.slots, activeDaysPerWeek: choice.days.length }, today),
      choice.days,
    );
    // F-13 a: the two optional questions become the habit's loop (its routine is the habit itself).
    if (choice.withAnswers && (cue.trim() || ifThen.trim())) {
      plan = addHabitLoop(plan, newUuid(), {
        cue: cue.trim(),
        craving: '',
        routine: english ? habit.titleEn : habit.titleAr,
        reward: '',
        ...(ifThen.trim() ? { ifThen: ifThen.trim() } : {}),
      });
    }
    const free = freeMinutesValue(minutes);
    if (firstHabit) onFirstPlan?.();
    // On a «يومي ثقيل» day the new habit is lightened too, so the day stays light and the toggle stays on.
    updateStore((store) => {
      const withPlan = upsertPlan(store, isEbbDay(store.plans, today) ? startEbb(plan, today) : plan);
      return free !== null && freeMinutes === undefined ? updateSettings(withPlan, { freeMinutesPerDay: free }) : withPlan;
    });
    if (firstHabit) setStep('finish');
    else {
      toast.success(tSetup('added', { title: english ? habit.titleEn : habit.titleAr }));
      onDone();
    }
  }

  const validSlots = () => [slots[0], slots[1]].filter((s) => isValidTime(s) || isPrayerAnchor(s));
  const defaultsFor = (h: PracticeHabit) => [h.defaultSlots[0] ?? '08:00', h.defaultSlots[1] ?? ''].filter((s) => isValidTime(s));

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">{t('stepOf', { step: formatDigits(Math.min(index + 1, 3)) })}</p>
        <ol className="flex gap-2" aria-label={t('stepOf', { step: formatDigits(Math.min(index + 1, 3)) })}>
          {ONBOARDING_STEPS.map((key, i) => (
            <li key={key} aria-current={i === index ? 'step' : undefined}>
              <span aria-hidden className={cn('block size-2.5 rounded-full', i <= index ? 'bg-primary' : 'bg-border')} />
            </li>
          ))}
        </ol>
      </div>

      {step === 'what' ? (
        <StepFrame
          headingRef={stepRef}
          title={t('what.title')}
          hint={t('what.hint')}
          example={t('what.example')}
          onNext={() => goWhen(habitKey)}
          onSkip={() => goWhen(habitKey ?? defaultHabitKey(available.map((h) => h.key)))}
          onBack={onCancel}
          backLabel={tSetup('cancel')}
        >
          {firstHabit ? <StoryLine moment="lateStart" /> : null}
          {available.length === 0 ? <p>{tSetup('allChosen')}</p> : null}
          <fieldset className="flex flex-col gap-3" aria-describedby={error ? 'setup-error' : undefined}>
            <legend className="sr-only">{t('what.title')}</legend>
            <ul className="grid gap-3 sm:grid-cols-2">
              {available.map((h) => (
                <li key={h.key}>
                  <label className="flex h-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 has-[:checked]:border-primary has-[:focus-visible]:border-primary">
                    <input
                      type="radio"
                      name="habit"
                      className="mt-1.5 size-4 shrink-0 accent-primary"
                      checked={habitKey === h.key}
                      onChange={() => choose(h.key)}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-lg font-medium">{english ? h.titleEn : h.titleAr}</span>
                      {(english ? h.timeHintEn : h.timeHintAr) ? (
                        <span className="text-sm text-muted-foreground">{english ? h.timeHintEn : h.timeHintAr}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {error ? (
            <p id="setup-error" className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </StepFrame>
      ) : null}

      {step === 'when' && habit ? (
        <StepFrame
          headingRef={stepRef}
          eyebrow={english ? habit.titleEn : habit.titleAr}
          title={t('when.title')}
          hint={t('when.hint')}
          // The generic «بعد الفجر… المغرب» example only fits a habit without a time window (it contradicts Duha's).
          example={habit.window ? ((english ? habit.timeHintEn : habit.timeHintAr) ?? range(habit.window)) : t('when.example')}
          onNext={() => {
            const problems = slots.map((slot) => slotProblem(slot, habit.window, prayer));
            const messages = problems.map((problem) =>
              problem && habit.window ? tSetup('errors.outside', { range: range(habit.window) }) : null,
            ) as [string | null, string | null];
            setSlotErrors(messages);
            if (messages.some(Boolean)) return;
            if (validSlots().length === 0) {
              setError(tSetup('errors.time'));
              return;
            }
            setError(null);
            setStep('howMuch');
          }}
          onSkip={() => {
            setSlots([habit.defaultSlots[0] ?? '08:00', habit.defaultSlots[1] ?? '']);
            setDays(planWeekdays({}, habit.defaultRule) ?? [...ALL_DAYS]);
            setCue('');
            setIfThen('');
            setError(null);
            setSlotErrors([null, null]);
            setStep('howMuch');
          }}
          onBack={() => setStep('what')}
          backLabel={tSetup('back')}
        >
          <StrategyLine idea={tStrategy('items.anchor-prayer.idea')} />
          <WindowLine window={habit.window} prayer={prayer} />
          <WhenFields
            slots={slots}
            onSlots={(next) => {
              setSlots(next);
              setSlotErrors([null, null]);
            }}
            days={days}
            onDays={setDays}
            habit={habit}
            prayer={prayer}
            errors={slotErrors}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-medium">{t('loop.title')}</legend>
            <LineField label={t('loop.cue')} hint={t('loop.cueExample')} value={cue} onChange={setCue} />
            <LineField label={t('loop.ifThen')} hint={t('loop.ifThenExample')} value={ifThen} onChange={setIfThen} />
          </fieldset>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </StepFrame>
      ) : null}

      {step === 'howMuch' && habit ? (
        <StepFrame
          headingRef={stepRef}
          eyebrow={english ? habit.titleEn : habit.titleAr}
          title={t('howMuch.title')}
          hint={t('howMuch.hint')}
          example={t('howMuch.example')}
          nextLabel={tSetup('create')}
          onNext={() => create({ slots: validSlots(), days, distance, withAnswers: true })}
          onSkip={() =>
            create({ slots: validSlots().length > 0 ? validSlots() : defaultsFor(habit), days, distance: 'far', withAnswers: true })
          }
          onBack={() => setStep('when')}
          backLabel={tSetup('back')}
        >
          <StrategyLine idea={tStrategy('items.start-tiny.idea')} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2">{tSetup('distanceQuestion')}</legend>
            {DISTANCES.map((d) => (
              <label key={d} className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="radio" name="distance" className="size-4 accent-primary" checked={distance === d} onChange={() => setDistance(d)} />
                <span>
                  {tSetup(d)} —{' '}
                  {tSetup('startWith', {
                    amount: amountLabel(habit.start[d], habit.unit, english ? habit.unitLabelEn : habit.unitLabelAr, english, habit.rakah),
                  })}
                </span>
              </label>
            ))}
          </fieldset>
          {freeMinutes === undefined ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={minutesId} className="text-base">
                {tSetup('freeMinutesQuestion')}
              </label>
              <Input
                id={minutesId}
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                step={10}
                className="h-11 w-40"
                value={minutes}
                aria-describedby={`${minutesId}-hint`}
                onChange={(e) => setMinutes(e.target.value)}
              />
              <p id={`${minutesId}-hint`} className="text-sm leading-7 text-muted-foreground">
                {tSetup('freeMinutesHint')}
              </p>
            </div>
          ) : null}
          {(freeMinutes ?? freeMinutesValue(minutes)) !== null &&
          (freeMinutes ?? freeMinutesValue(minutes)) !== undefined &&
          loadWarning(
            [
              ...existing,
              planFromHabit(
                habit,
                { distance, slots: validSlots().length > 0 ? validSlots() : defaultsFor(habit), activeDaysPerWeek: days.length },
                today,
                'preview',
              ),
            ],
            (freeMinutes ?? freeMinutesValue(minutes)) as number,
          ) ===
            'over' ? (
            <p className="next-step" role="status">
              {tSetup('loadOver')}
            </p>
          ) : null}
        </StepFrame>
      ) : null}

      {step === 'finish' ? (
        <section className="flex flex-col gap-6" aria-labelledby="setup-finish-title">
          <h2 id="setup-finish-title" ref={stepRef} tabIndex={-1} className="text-2xl font-medium focus:outline-none">
            {t('finishTitle')}
          </h2>
          <p className="text-muted-foreground">{t('finishLead')}</p>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            <Switch
              label={t('intention')}
              hint={t('intentionHint')}
              checked={heart?.prefs.intention ?? false}
              onChange={(on) => updateHeart((h) => setHeartPrefs(h, { intention: on }))}
            />
            <Switch
              label={t('evening')}
              hint={t('eveningHint')}
              checked={heart?.prefs.eveningReview ?? false}
              onChange={(on) => updateHeart((h) => setHeartPrefs(h, { eveningReview: on }))}
            />
          </ul>
          {heart && !heart.prefs.cardsSeen ? (
            <div className="flex flex-col gap-4">
              <HabitLoopCard />
              <ConsistencyCard />
            </div>
          ) : null}
          <button
            type="button"
            className="solid-button button-wrap self-start"
            onClick={() => {
              updateHeart((h) => setHeartPrefs(h, { cardsSeen: true }));
              onDone();
            }}
          >
            {t('done')} <DirectionalArrow />
          </button>
        </section>
      ) : null}
    </div>
  );
}

interface StepFrameProps {
  headingRef: React.Ref<HTMLHeadingElement>;
  eyebrow?: string;
  title: string;
  hint: string;
  example: string;
  children: React.ReactNode;
  nextLabel?: string;
  onNext: () => void;
  onSkip: () => void;
  onBack?: () => void;
  backLabel: string;
}

/** One screen: the question, ONE hint line, one example, the fields, then «التالي», «تخطَّ» and «السابق». */
function StepFrame({ headingRef, eyebrow, title, hint, example, children, nextLabel, onNext, onSkip, onBack, backLabel }: StepFrameProps) {
  const tSetup = useTranslations('practice.setup');
  const t = useTranslations('practice.onboarding');
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        {eyebrow ? <p className="text-sm text-muted-foreground">{eyebrow}</p> : null}
        <h2 ref={headingRef} tabIndex={-1} className="text-3xl font-medium focus:outline-none">
          {title}
        </h2>
        <p className="text-base leading-8">{hint}</p>
        <p className="text-sm leading-7 text-muted-foreground">{example}</p>
      </div>
      {children}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="solid-button button-wrap" onClick={onNext}>
          {nextLabel ?? tSetup('next')} <DirectionalArrow />
        </button>
        <button type="button" className="outline-button button-wrap" onClick={onSkip}>
          {t('skip')}
        </button>
        {onBack ? (
          <button type="button" className="outline-button button-wrap" onClick={onBack}>
            {backLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function WhenFields({
  slots,
  onSlots,
  days,
  onDays,
  habit,
  prayer,
  errors,
}: {
  slots: [string, string];
  onSlots: (slots: [string, string]) => void;
  days: number[];
  onDays: (days: number[]) => void;
  habit: PracticeHabit;
  prayer: PrayerTimesWithSunrise | undefined;
  errors: [string | null, string | null];
}) {
  const tSetup = useTranslations('practice.setup');
  const t = useTranslations('practice.onboarding');
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2">{t('slots')}</legend>
        {([0, 1] as const).map((i) => (
          <SlotPicker
            key={i}
            label={tSetup('slot', { n: String(i + 1) })}
            value={slots[i]}
            optional={i === 1}
            anchors={suitableAnchors(habit)}
            prayer={prayer}
            error={errors[i]}
            onChange={(value) => onSlots(i === 0 ? [value, slots[1]] : [slots[0], value])}
          />
        ))}
      </fieldset>
      <DayChips value={days} onChange={onDays} legend={tSetup('days')} />
    </div>
  );
}

/** One strategy at its moment (F-12 a): a quiet line in the step it belongs to. */
function StrategyLine({ idea }: { idea: string }) {
  const t = useTranslations('practice.setup');
  return (
    <p className="rounded-xl border-s-2 border-primary bg-secondary/60 px-4 py-2.5 text-sm leading-7">
      <span className="font-medium text-primary-text">{t('strategy')}: </span>
      {idea}
    </p>
  );
}

/** An optional one-line answer. */
function LineField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <Input id={id} value={value} maxLength={MAX_LOOP_TEXT} placeholder={hint} onChange={(e) => onChange(e.target.value)} className="h-11" />
    </div>
  );
}

/** «كم دقيقة حرة لديك؟»: a whole number 0…1440, else null. */
function freeMinutesValue(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= 0 && n <= 1440 ? n : null;
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  const hintId = useId();
  const labelId = useId();
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span id={labelId} className="text-base">
          {label}
        </span>
        <p id={hintId} className="text-sm leading-7 text-muted-foreground">
          {hint}
        </p>
      </div>
      <KitSwitch aria-labelledby={labelId} aria-describedby={hintId} checked={checked} onCheckedChange={onChange} className="-mt-1.5" />
    </li>
  );
}
