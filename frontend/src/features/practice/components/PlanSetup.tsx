'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  addHabitLoop,
  addSelfMessage,
  cleanSelfMessage,
  defaultHabitKey,
  EBB_AMOUNT,
  isPrayerAnchor,
  isValidTime,
  loadWarning,
  MAX_LOOP_TEXT,
  SELF_MESSAGE_MAX_LENGTH,
  SELF_MESSAGES_MAX,
  setHeartPrefs,
  setMinimum,
  startEbb,
  updateSettings,
  upsertPlan,
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

/** The steps of «أضف عادة» (round 6, C-02f): العادة · القدر والوقت · رسالة إلى نفسك (optional) · المراجعة. */
const STEPS = ['what', 'amountTime', 'message', 'review'] as const;
type Step = (typeof STEPS)[number] | 'finish';

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

/**
 * «أضف عادة» (round 6, C-02f; reference step indicator): «العادة» (which habit), «القدر والوقت» (far/near → a very small
 * start, its «القدر الأدنى», the reminder times and days, and the two optional loop questions «بعد ماذا ستفعلها؟» /
 * «إذا منعك شيء، فماذا تفعل؟»), an optional, skippable «رسالة إلى نفسك» (it joins «رسائلي إلى نفسي»), then
 * «المراجعة» before saving. The strategy of each moment is one line in its step (F-12 a). After the FIRST habit only:
 * the two switches «نية اليوم» and «المحاسبة المسائية» (opt-in) and, once, «حلقة العادة» and «الاستمرار». A later habit
 * closes the flow with a toast and goes back. The limit of 3 is checked before this opens (AddHabitFlow).
 */
export function PlanSetup({ habits, existing, preselected, freeMinutes, today, onDone, onCancel, onFirstPlan }: PlanSetupProps) {
  const t = useTranslations('practice.onboarding');
  const tSetup = useTranslations('practice.setup');
  const tAdd = useTranslations('practice.addFlow');
  const english = useLocale() === 'en';
  const heart = useHeart();
  const firstHabit = existing.length === 0;
  const available = habits.filter((habit) => !existing.some((plan) => (plan.habitKey ?? plan.id) === habit.key));
  const preselectedOk = preselected && available.some((habit) => habit.key === preselected) ? preselected : null;
  const [step, setStep] = useState<Step>(preselectedOk ? 'amountTime' : 'what');
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
  const [minimum, setMinimumValue] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** «متى؟»: a slot outside the deed's window, per field (0, 1). */
  const [slotErrors, setSlotErrors] = useState<[string | null, string | null]>([null, null]);
  const prayer = usePrayerTimesToday();
  const range = useWindowRange();
  const stepRef = useFocusOnChange<HTMLHeadingElement>(step);
  const tStrategy = useTranslations('practice.strategies');
  const minutesId = useId();
  const minimumId = useId();
  const messageId = useId();
  const habit = available.find((h) => h.key === habitKey);
  const index = step === 'finish' ? STEPS.length : STEPS.indexOf(step);
  const startAmount = habit ? (habit.ceiling !== undefined ? Math.min(habit.start[distance], habit.ceiling) : habit.start[distance]) : 1;
  const chosenMinimum = Math.min(minimum ?? Math.min(startAmount, EBB_AMOUNT), startAmount);
  const messagesFull = (heart?.messages?.length ?? 0) >= SELF_MESSAGES_MAX;
  const words = (n: number) => (habit ? amountLabel(n, habit.unit, english ? habit.unitLabelEn : habit.unitLabelAr, english, habit.rakah) : String(n));

  function choose(key: string) {
    const chosen = available.find((h) => h.key === key);
    setHabitKey(key);
    setError(null);
    setMinimumValue(null);
    if (chosen) {
      setSlots([chosen.defaultSlots[0] ?? '08:00', chosen.defaultSlots[1] ?? '']);
      setDays(planWeekdays({}, chosen.defaultRule) ?? [...ALL_DAYS]);
    }
  }

  function goAmountTime(key: string | null) {
    if (!key) {
      setError(tSetup('errors.chooseOne'));
      return;
    }
    if (key !== habitKey || !slots[0]) choose(key);
    setStep('amountTime');
  }

  const validSlots = () => [slots[0], slots[1]].filter((s) => isValidTime(s) || isPrayerAnchor(s));
  const defaultsFor = (h: PracticeHabit) => [h.defaultSlots[0] ?? '08:00', h.defaultSlots[1] ?? ''].filter((s) => isValidTime(s));
  const finalSlots = () => (habit ? (validSlots().length > 0 ? validSlots() : defaultsFor(habit)) : []);

  function checkAmountTime(): boolean {
    if (!habit) return false;
    const problems = slots.map((slot) => slotProblem(slot, habit.window, prayer));
    const messages = problems.map((problem) => (problem && habit.window ? tSetup('errors.outside', { range: range(habit.window) }) : null)) as [
      string | null,
      string | null,
    ];
    setSlotErrors(messages);
    if (messages.some(Boolean)) return false;
    if (validSlots().length === 0) {
      setError(tSetup('errors.time'));
      return false;
    }
    setError(null);
    return true;
  }

  function create() {
    if (!habit) return;
    let plan = withWeekdays(planFromHabit(habit, { distance, slots: finalSlots(), activeDaysPerWeek: days.length }, today), days);
    plan = setMinimum(plan, Math.min(chosenMinimum, plan.amount));
    // F-13 a: the two optional questions become the habit's loop (its routine is the habit itself).
    if (cue.trim() || ifThen.trim()) {
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
    // The optional «رسالة إلى نفسك» joins «رسائلي إلى نفسي», tied to this habit.
    if (cleanSelfMessage(message) && !messagesFull) updateHeart((h) => addSelfMessage(h, { id: newUuid(), text: message, planId: plan.id }));
    if (firstHabit) setStep('finish');
    else {
      toast.success(tSetup('added', { title: english ? habit.titleEn : habit.titleAr }));
      onDone();
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {step === 'finish' ? null : <StepIndicator index={index} />}

      {step === 'what' ? (
        <StepFrame
          headingRef={stepRef}
          title={t('what.title')}
          hint={t('what.hint')}
          example={t('what.example')}
          onNext={() => goAmountTime(habitKey)}
          onSkip={() => goAmountTime(habitKey ?? defaultHabitKey(available.map((h) => h.key)))}
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

      {step === 'amountTime' && habit ? (
        <StepFrame
          headingRef={stepRef}
          eyebrow={english ? habit.titleEn : habit.titleAr}
          title={tAdd('amountTime.title')}
          hint={tAdd('amountTime.hint')}
          example={habit.window ? ((english ? habit.timeHintEn : habit.timeHintAr) ?? range(habit.window)) : t('when.example')}
          onNext={() => {
            if (checkAmountTime()) setStep('message');
          }}
          onSkip={() => {
            setSlots([habit.defaultSlots[0] ?? '08:00', habit.defaultSlots[1] ?? '']);
            setDays(planWeekdays({}, habit.defaultRule) ?? [...ALL_DAYS]);
            setDistance('far');
            setMinimumValue(null);
            setCue('');
            setIfThen('');
            setError(null);
            setSlotErrors([null, null]);
            setStep('message');
          }}
          onBack={() => setStep('what')}
          backLabel={tSetup('back')}
        >
          <StrategyLine idea={tStrategy('items.start-tiny.idea')} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2">{tSetup('distanceQuestion')}</legend>
            {DISTANCES.map((d) => (
              <label key={d} className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="distance"
                  className="size-4 accent-primary"
                  checked={distance === d}
                  onChange={() => {
                    setDistance(d);
                    setMinimumValue(null);
                  }}
                />
                <span>
                  {tSetup(d)} — {tSetup('startWith', { amount: words(habit.start[d]) })}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor={minimumId} className="text-base">
              {tAdd('minimum')}
            </label>
            <Select value={String(chosenMinimum)} onValueChange={(v) => setMinimumValue(Number(v))}>
              <SelectTrigger id={minimumId} className="h-11 w-52" aria-describedby={`${minimumId}-hint`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: startAmount }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {words(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id={`${minimumId}-hint`} className="text-sm leading-7 text-muted-foreground">
              {tAdd('minimumHint')}
            </p>
          </div>
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
            [...existing, planFromHabit(habit, { distance, slots: finalSlots(), activeDaysPerWeek: days.length }, today, 'preview')],
            (freeMinutes ?? freeMinutesValue(minutes)) as number,
          ) === 'over' ? (
            <p className="next-step" role="status">
              {tSetup('loadOver')}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </StepFrame>
      ) : null}

      {step === 'message' && habit ? (
        <StepFrame
          headingRef={stepRef}
          eyebrow={english ? habit.titleEn : habit.titleAr}
          title={tAdd('message.title')}
          hint={tAdd('message.hint')}
          example={tAdd('message.example')}
          onNext={() => setStep('review')}
          onSkip={() => {
            setMessage('');
            setStep('review');
          }}
          onBack={() => setStep('amountTime')}
          backLabel={tSetup('back')}
        >
          {messagesFull ? (
            <p className="text-sm leading-7 text-muted-foreground">{tAdd('message.full', { max: formatDigits(SELF_MESSAGES_MAX) })}</p>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor={messageId} className="text-sm font-medium">
                {tAdd('message.field')}
              </label>
              <Textarea id={messageId} rows={3} maxLength={SELF_MESSAGE_MAX_LENGTH} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          )}
        </StepFrame>
      ) : null}

      {step === 'review' && habit ? (
        <section className="flex flex-col gap-5" aria-labelledby="setup-review-title">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">{english ? habit.titleEn : habit.titleAr}</p>
            <h2 id="setup-review-title" ref={stepRef} tabIndex={-1} className="text-3xl font-medium focus:outline-none">
              {tAdd('review.title')}
            </h2>
            <p className="text-base leading-8">{tAdd('review.hint')}</p>
          </div>
          <dl className="flex flex-col divide-y divide-border border-y border-border">
            <ReviewItem label={tAdd('review.habit')} value={english ? habit.titleEn : habit.titleAr} onEdit={() => setStep('what')} editLabel={tAdd('review.edit')} />
            <ReviewItem label={tAdd('review.amount')} value={words(startAmount)} onEdit={() => setStep('amountTime')} editLabel={tAdd('review.edit')} />
            <ReviewItem label={tAdd('minimum')} value={words(chosenMinimum)} onEdit={() => setStep('amountTime')} editLabel={tAdd('review.edit')} />
            <ReviewItem
              label={tAdd('review.days')}
              value={days.length === 7 ? tAdd('review.everyDay') : tAdd('review.daysCount', { count: days.length, n: formatDigits(days.length) })}
              onEdit={() => setStep('amountTime')}
              editLabel={tAdd('review.edit')}
            />
            <ReviewItem label={tAdd('review.times')} value={finalSlots().length > 0 ? tAdd('review.timesCount', { count: finalSlots().length, n: formatDigits(finalSlots().length) }) : '—'} onEdit={() => setStep('amountTime')} editLabel={tAdd('review.edit')} />
            {cue.trim() || ifThen.trim() ? (
              <ReviewItem label={t('loop.title')} value={[cue.trim(), ifThen.trim()].filter(Boolean).join(' · ')} onEdit={() => setStep('amountTime')} editLabel={tAdd('review.edit')} />
            ) : null}
            {cleanSelfMessage(message) ? <ReviewItem label={tAdd('message.title')} value={message.trim()} onEdit={() => setStep('message')} editLabel={tAdd('review.edit')} /> : null}
          </dl>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="solid-button button-wrap" onClick={create}>
              {tSetup('create')} <DirectionalArrow />
            </button>
            <button type="button" className="outline-button button-wrap" onClick={() => setStep('message')}>
              {tSetup('back')}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'finish' ? (
        <section className="flex flex-col gap-6" aria-labelledby="setup-finish-title">
          <h2 id="setup-finish-title" ref={stepRef} tabIndex={-1} className="text-2xl font-medium focus:outline-none">
            {t('finishTitle')}
          </h2>
          <p className="text-muted-foreground">{t('finishLead')}</p>
          <ul className="flex flex-col divide-y divide-border border-b border-border">
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

/** The reference step indicator: numbered circles with their names; done and current steps filled. */
function StepIndicator({ index }: { index: number }) {
  const t = useTranslations('practice.addFlow.steps');
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={t('label')}>
      {STEPS.map((key, i) => (
        <li key={key} aria-current={i === index ? 'step' : undefined} className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'flex size-7 items-center justify-center rounded-full border text-sm tabular-nums',
              i <= index ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
            )}
          >
            {formatDigits(i + 1)}
          </span>
          <span className={cn('text-sm', i === index ? 'font-medium text-foreground' : 'text-muted-foreground')}>{t(key)}</span>
        </li>
      ))}
    </ol>
  );
}

function ReviewItem({ label, value, onEdit, editLabel }: { label: string; value: string; onEdit: () => void; editLabel: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 flex-col">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-base break-words">{value}</dd>
      </div>
      <button type="button" onClick={onEdit} className="text-link min-h-11 shrink-0 px-1 text-sm">
        {editLabel}
      </button>
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
