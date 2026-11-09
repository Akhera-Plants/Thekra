'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { isPrayerAnchor, isValidTime, slotChoices, updatePlan, type Plan } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { planWeekdays, sameWeekdays, withWeekdays } from '@/lib/practice/days';
import { editPlan, lowerAmounts } from '@/lib/practice/plans';
import { usePrayerTimesToday } from '@/lib/practice/screen-stores';
import { updateStore } from '@/lib/practice/local-store';
import { slotProblem, suitableAnchors } from '@/lib/practice/windows';
import type { PracticeHabit } from '@/lib/types/practice';
import { DayChips } from '../DayChips';
import { SlotPicker, useWindowRange, WindowLine } from '../SlotPicker';

/** Time fields shown: the plan's times plus one empty field, at least two, at most four. */
const MAX_SLOTS = 4;

interface HabitSettingsFormProps {
  plan: Plan;
  habit: PracticeHabit | undefined;
  today: string;
  amountLabel: (n: number) => string;
  /** After a save (a toast is shown). */
  onDone?: () => void;
}

/**
 * «التذكيرات» of the habit page (round 6 §3, reference tab): the reminder times (only those that suit the deed's
 * window), the days themselves (A-13 a) and a lower everyday amount (going up stays with «زد خطوة»). Archive and delete
 * are in the page's «⋯». Saving says so.
 */
export function HabitSettingsForm({ plan, habit, today, amountLabel, onDone }: HabitSettingsFormProps) {
  const t = useTranslations('practice.habitPage');
  const tSetup = useTranslations('practice.setup');
  const tToday = useTranslations('practice.today');
  const prayer = usePrayerTimesToday();
  const range = useWindowRange();
  const window = habit?.window;
  const choices = useMemo(() => slotChoices(plan), [plan]);
  const fieldCount = Math.min(MAX_SLOTS, Math.max(2, plan.slots.length + 1));
  const [slots, setSlots] = useState<string[]>(() => Array.from({ length: fieldCount }, (_, i) => choices[i] ?? ''));
  const startDays = planWeekdays(plan, habit?.defaultRule);
  const [days, setDays] = useState<number[]>(() => startDays ?? []);
  const amounts = useMemo(() => lowerAmounts(plan), [plan]);
  const [amount, setAmount] = useState(String(amounts[0]));
  const [errors, setErrors] = useState<(string | null)[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  function save() {
    const next = slots.map((slot) => {
      if (slot === '') return null;
      if (!isValidTime(slot) && !isPrayerAnchor(slot)) return tSetup('errors.time');
      return slotProblem(slot, window, prayer) && window ? tSetup('errors.outside', { range: range(window) }) : null;
    });
    setErrors(next);
    if (next.some(Boolean)) return;
    const chosen = slots.filter(Boolean);
    if (chosen.length === 0) {
      setFormError(tToday('editSlotsRequired'));
      return;
    }
    updateStore((store) =>
      updatePlan(store, plan.id, (p) => {
        let edited = editPlan(p, { slots: chosen, activeDaysPerWeek: p.activeDaysPerWeek, amount: Number(amount) }, today);
        // A rule that is not by weekday (a Hijri date…) has no day chips: it stays as it is.
        if (startDays !== null && days.length > 0 && !sameWeekdays(edited, days, habit?.defaultRule)) edited = withWeekdays(edited, days);
        return edited;
      }),
    );
    toast.success(t('saved'));
    onDone?.();
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-medium">{t('times')}</legend>
        <WindowLine window={window} prayer={prayer} />
        <div className="grid gap-4 sm:grid-cols-2">
          {slots.map((value, index) => (
            <SlotPicker
              key={index}
              label={tSetup('slot', { n: String(index + 1) })}
              value={value}
              optional
              anchors={suitableAnchors(habit)}
              prayer={prayer}
              error={errors[index] ?? null}
              onChange={(slot) => {
                setSlots((prev) => prev.map((s, i) => (i === index ? slot : s)));
                setErrors([]);
                setFormError(null);
              }}
            />
          ))}
        </div>
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">{tToday('editSlotsHint')}</p>
        )}
      </fieldset>

      {startDays !== null ? <DayChips value={days} onChange={setDays} legend={tSetup('days')} /> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`amount-${plan.id}`}>{tToday('editAmount')}</Label>
        <Select value={amount} onValueChange={setAmount}>
          <SelectTrigger id={`amount-${plan.id}`} className="w-full sm:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {amounts.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {amountLabel(n)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm leading-7 text-muted-foreground">{tToday('editAmountHint')}</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <Button className="self-start" onClick={save}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
