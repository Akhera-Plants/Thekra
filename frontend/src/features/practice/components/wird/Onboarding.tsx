'use client';

import { useId, useState, useSyncExternalStore } from 'react';
import { BookOpen, DoorOpen, Sprout } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { isValidTime, upsertPlan, updatePlan, type Plan } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { formatDigits } from '@/lib/format/digits';
import { updateStore } from '@/lib/practice/local-store';
import { planFromHabit } from '@/lib/practice/plans';
import { isPeriodicTemplate } from '@/lib/practice/limits';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { useFocusOnChange } from '../../hooks/useFocusOnChange';
import { amountLabel } from '../amount-label';
import { TimeField } from '../TimeField';

/** Per-device: the three steps show once (a second device of the same member already has habits, so they never show). */
const DONE_KEY = 'thekra.practice.onboarding.v1';
const listeners = new Set<() => void>();

function readDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone(): void {
  try {
    window.localStorage.setItem(DONE_KEY, '1');
  } catch {
    // Storage blocked: the steps may show again on the next visit; nothing else depends on it.
  }
  listeners.forEach((listener) => listener());
}

/** True once the start was finished or skipped on this device; false during the server render. */
export function useOnboardingDone(): boolean | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readDone,
    () => null,
  );
}

type Goal = 'deed' | 'sin' | 'read';
type Step = 'goal' | 'habit' | 'time';

/** How many habits the second step offers (the catalog's own order: the easiest to start first). */
const OFFERED = 6;

/**
 * The start after «إنشاء حساب» (round 5, F-26 a): three short steps, each skippable, the same on the app.
 * 1. «ماذا تريد الآن؟»: a good deed · leaving a sin (never named) · reading only.
 * 2. One habit at its smallest amount, or «ابدأ تخفَّف».
 * 3. Its reminder time.
 * Then «ورد اليوم» with the habit in it. Shown once per device, and never to a member who already has a habit.
 */
export function Onboarding({ habits, today }: { habits: readonly PracticeHabit[]; today: string }) {
  const t = useTranslations('practice.start');
  const tSetup = useTranslations('practice.onboarding');
  const english = useLocale() === 'en';
  const [step, setStep] = useState<Step>('goal');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [habitKey, setHabitKey] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const headingRef = useFocusOnChange<HTMLHeadingElement>(step);
  const timeId = useId();
  const offered = habits.filter((h) => !isPeriodicTemplate(h)).slice(0, OFFERED);
  const chosen = offered.find((h) => h.key === habitKey);
  const index = step === 'goal' ? 1 : step === 'habit' ? 2 : 3;

  function finish(message?: string) {
    markOnboardingDone();
    if (message) toast.success(message);
  }

  function createHabit() {
    if (!chosen) return;
    // The smallest start («بعيد عنها») and the catalog's first time; the days are every day.
    const plan = planFromHabit(chosen, { distance: 'far', slots: chosen.defaultSlots.slice(0, 1), activeDaysPerWeek: 7 }, today);
    updateStore((s) => upsertPlan(s, plan));
    setPlanId(plan.id);
    setTime(chosen.defaultSlots[0] && isValidTime(chosen.defaultSlots[0]) ? chosen.defaultSlots[0] : '08:00');
    setStep('time');
  }

  function saveTime() {
    if (planId && isValidTime(time)) {
      updateStore((s) =>
        updatePlan(s, planId, (p) => {
          const next: Plan = { ...p, slots: [time] };
          delete next.slotAnchors;
          return next;
        }),
      );
    }
    finish(t('ready'));
  }

  return (
    <section aria-labelledby="start-title" className="flex max-w-3xl flex-col gap-6 rounded-2xl border border-border bg-card p-5 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{tSetup('stepOf', { step: formatDigits(index) })}</p>
        <Button variant="ghost" tone="neutral" size="sm" onClick={() => finish()}>
          {t('skipAll')}
        </Button>
      </div>

      {step === 'goal' ? (
        <>
          <h2 id="start-title" ref={headingRef} tabIndex={-1} className="text-2xl font-medium focus:outline-none">
            {t('goal.title')}
          </h2>
          <div role="radiogroup" aria-labelledby="start-title" className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['deed', <Sprout key="i" />],
                ['sin', <DoorOpen key="i" />],
                ['read', <BookOpen key="i" />],
              ] as const
            ).map(([key, icon]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={goal === key}
                onClick={() => setGoal(key)}
                className={cn(
                  'flex min-h-24 flex-col items-start gap-2 rounded-xl border p-4 text-start transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  goal === key ? 'border-primary bg-secondary' : 'border-border hover:bg-muted',
                )}
              >
                <span aria-hidden className="text-primary-text [&_svg]:size-5">
                  {icon}
                </span>
                <span className="text-base font-medium">{t(`goal.${key}`)}</span>
              </button>
            ))}
          </div>
          <ActionPair layout="hug">
            <Button
              disabled={!goal}
              onClick={() => {
                if (goal === 'read') finish();
                else setStep('habit');
              }}
            >
              {tSetup('done')} <DirectionalArrow />
            </Button>
            <Button variant="outline" tone="neutral" onClick={() => setStep('habit')}>
              {tSetup('skip')}
            </Button>
          </ActionPair>
        </>
      ) : null}

      {step === 'habit' ? (
        <>
          <h2 id="start-title" ref={headingRef} tabIndex={-1} className="text-2xl font-medium focus:outline-none">
            {goal === 'sin' ? t('sin.title') : t('habit.title')}
          </h2>
          {goal === 'sin' ? (
            <>
              <p className="text-base leading-8 text-muted-foreground">{t('sin.lead')}</p>
              <ActionPair layout="hug">
                <Button asChild>
                  <Link href="/practice/leave-sin" onClick={() => finish()}>
                    {t('sin.start')} <DirectionalArrow />
                  </Link>
                </Button>
                <Button variant="outline" tone="neutral" onClick={() => setGoal('deed')}>
                  {t('sin.deedInstead')}
                </Button>
              </ActionPair>
            </>
          ) : (
            <>
              <p className="text-base leading-8 text-muted-foreground">{t('habit.lead')}</p>
              <fieldset>
                <legend className="sr-only">{t('habit.title')}</legend>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {offered.map((h) => (
                    <li key={h.key}>
                      <label className="flex h-full cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:border-primary">
                        <input
                          type="radio"
                          name="start-habit"
                          className="mt-1.5 size-4 shrink-0 accent-primary"
                          checked={habitKey === h.key}
                          onChange={() => setHabitKey(h.key)}
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-base font-medium">{english ? h.titleEn : h.titleAr}</span>
                          <span className="text-sm text-muted-foreground">
                            {t('habit.amount', {
                              amount: amountLabel(h.start.far, h.unit, english ? h.unitLabelEn : h.unitLabelAr, english, h.rakah),
                            })}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <ActionPair layout="hug">
                <Button disabled={!chosen} onClick={createHabit}>
                  {t('habit.add')} <DirectionalArrow />
                </Button>
                <Button variant="outline" tone="neutral" onClick={() => finish()}>
                  {tSetup('skip')}
                </Button>
              </ActionPair>
            </>
          )}
        </>
      ) : null}

      {step === 'time' && chosen ? (
        <>
          <h2 id="start-title" ref={headingRef} tabIndex={-1} className="text-2xl font-medium focus:outline-none">
            {t('time.title')}
          </h2>
          <p className="text-base leading-8 text-muted-foreground">{t('time.lead', { title: english ? chosen.titleEn : chosen.titleAr })}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={timeId} className="text-sm font-medium">
              {t('time.label')}
            </label>
            <TimeField id={timeId} label={t('time.label')} value={time} onChange={setTime} />
          </div>
          <ActionPair layout="hug">
            <Button onClick={saveTime}>{t('time.save')}</Button>
            <Button variant="outline" tone="neutral" onClick={() => finish(t('ready'))}>
              {tSetup('skip')}
            </Button>
          </ActionPair>
        </>
      ) : null}
    </section>
  );
}
