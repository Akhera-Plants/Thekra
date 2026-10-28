'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { updateSettings, upsertPlan, type Plan } from '@thekra/practice-core';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Form } from '@/components/ui/form';
import { updateStore } from '@/lib/practice/local-store';
import { DEFAULT_ACTIVE_DAYS, planFromHabit, type Distance } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { formatDigits } from '@/lib/format/digits';
import { useFocusOnChange } from '../hooks/useFocusOnChange';
import { HabitShape, makeSetupSchema, RolesStep, type SetupValues } from './PlanSetupSteps';

const DEFAULT_FREE_MINUTES = 120;
/** The lecture's advice: two or three habits at a time, built slowly. */
const CALM_SELECTION = 2;

interface PlanSetupProps {
  habits: readonly PracticeHabit[];
  existing: readonly Plan[];
  freeMinutes: number | undefined;
  today: string;
  onDone: () => void;
  onCancel?: () => void;
}

type Step = 'choose' | 'shape' | 'roles';

/** «أعِنّي على طاعة» setup: choose habits → distance, times, days → «فروضي وأدواري» (free time) → plans. */
export function PlanSetup({ habits, existing, freeMinutes, today, onDone, onCancel }: PlanSetupProps) {
  const t = useTranslations('practice.setup');
  const locale = useLocale();
  const [step, setStep] = useState<Step>('choose');
  const stepRef = useFocusOnChange<HTMLParagraphElement>(step);
  const [selected, setSelected] = useState<string[]>([]);
  const [chooseError, setChooseError] = useState(false);
  const available = habits.filter((habit) => !existing.some((plan) => (plan.habitKey ?? plan.id) === habit.key));
  const chosen = available.filter((habit) => selected.includes(habit.key));

  const schema = useMemo(() => makeSetupSchema({ time: t('errors.time'), minutes: t('errors.minutes') }), [t]);
  const form = useForm<SetupValues>({
    resolver: zodResolver(schema),
    defaultValues: { plans: {}, freeMinutes: String(freeMinutes ?? DEFAULT_FREE_MINUTES) },
  });

  function toggle(key: string) {
    setChooseError(false);
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  function handleChosen() {
    if (chosen.length === 0) {
      setChooseError(true);
      return;
    }
    for (const habit of chosen) {
      if (form.getValues(`plans.${habit.key}`)) continue;
      form.setValue(`plans.${habit.key}`, {
        distance: 'far',
        slot1: habit.defaultSlots[0] ?? '08:00',
        slot2: habit.defaultSlots[1] ?? '',
        activeDays: String(DEFAULT_ACTIVE_DAYS),
      });
    }
    setStep('shape');
  }

  async function handleShaped() {
    const ok = await form.trigger(chosen.map((habit) => `plans.${habit.key}` as const));
    if (ok) setStep('roles');
  }

  function buildPlans(values: SetupValues): Plan[] {
    return chosen.map((habit) => {
      const entry = values.plans[habit.key];
      return planFromHabit(
        habit,
        {
          distance: (entry?.distance ?? 'far') as Distance,
          slots: [entry?.slot1 ?? '08:00', entry?.slot2 ?? ''].filter(Boolean),
          activeDaysPerWeek: Number(entry?.activeDays ?? DEFAULT_ACTIVE_DAYS),
        },
        today,
      );
    });
  }

  function handleSubmit(values: SetupValues) {
    const created = buildPlans(values);
    updateStore((store) =>
      created.reduce(
        (next, plan) => upsertPlan(next, plan),
        updateSettings(store, { freeMinutesPerDay: Number(values.freeMinutes) }),
      ),
    );
    onDone();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8" noValidate>
        <p ref={stepRef} tabIndex={-1} className="eyebrow focus:outline-none">
          {t('stepOf', { step: formatDigits(step === 'choose' ? 1 : step === 'shape' ? 2 : 3), total: '3' })}
        </p>

        {step === 'choose' ? (
          <fieldset className="flex flex-col gap-4" aria-describedby={chooseError ? 'choose-error' : undefined}>
            <legend className="mb-2 text-2xl font-medium">{t('chooseTitle')}</legend>
            <p className="text-muted-foreground">{t('chooseLead')}</p>
            {available.length === 0 ? <p>{t('allChosen')}</p> : null}
            <ul className="grid gap-3 sm:grid-cols-2">
              {available.map((habit) => (
                <li key={habit.key}>
                  <label className="flex h-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 has-[:checked]:border-primary has-[:focus-visible]:border-primary">
                    <input
                      type="checkbox"
                      className="mt-1.5 size-4 shrink-0 accent-primary"
                      checked={selected.includes(habit.key)}
                      onChange={() => toggle(habit.key)}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-lg font-medium">{locale === 'en' ? habit.titleEn : habit.titleAr}</span>
                      {(locale === 'en' ? habit.timeHintEn : habit.timeHintAr) ? (
                        <span className="text-sm text-muted-foreground">
                          {locale === 'en' ? habit.timeHintEn : habit.timeHintAr}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {chooseError ? (
              <p id="choose-error" className="text-sm text-destructive" role="alert">
                {t('errors.chooseOne')}
              </p>
            ) : null}
            {chosen.length > CALM_SELECTION ? <p className="next-step">{t('calmSelection')}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button type="button" className="solid-button button-wrap" onClick={handleChosen}>
                {t('next')} <DirectionalArrow />
              </button>
              {onCancel ? (
                <button type="button" className="outline-button button-wrap" onClick={onCancel}>
                  {t('cancel')}
                </button>
              ) : null}
            </div>
          </fieldset>
        ) : null}

        {step === 'shape' ? (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-medium">{t('shapeTitle')}</h2>
            <p className="text-muted-foreground">{t('shapeLead')}</p>
            {chosen.map((habit) => (
              <HabitShape key={habit.key} habit={habit} control={form.control} />
            ))}
            <div className="flex flex-wrap gap-3">
              <button type="button" className="solid-button button-wrap" onClick={() => void handleShaped()}>
                {t('next')} <DirectionalArrow />
              </button>
              <button type="button" className="outline-button button-wrap" onClick={() => setStep('choose')}>
                {t('back')}
              </button>
            </div>
          </div>
        ) : null}

        {step === 'roles' ? (
          <RolesStep
            control={form.control}
            existing={existing}
            build={() => buildPlans(form.getValues())}
            onBack={() => setStep('shape')}
          />
        ) : null}
      </form>
    </Form>
  );
}
