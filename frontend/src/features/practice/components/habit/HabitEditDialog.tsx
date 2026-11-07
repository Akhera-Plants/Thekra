'use client';

import { useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { isPaused, isPrayerAnchor, isValidTime, pausePlan, resumePlan, slotChoices, updatePlan, type Plan } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface HabitEditDialogProps {
  plan: Plan;
  habit: PracticeHabit | undefined;
  today: string;
  title: string;
  amountLabel: (n: number) => string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * «عدّل» on the habit page (round 5, F-31 a): ONE dialog for the reminder times (only those that suit the deed's
 * window), the days themselves (A-13 a), a lower everyday amount (going up stays with «زد خطوة») and «أوقف مؤقتًا» /
 * «استأنف». Delete is not here: it sits in the page's «⋯» with a confirmation. Saving closes and says so.
 */
export function HabitEditDialog({ plan, habit, today, title, amountLabel, open, onOpenChange }: HabitEditDialogProps) {
  const t = useTranslations('practice.habitPage');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-xl">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{t('editTitle')}</DialogTitle>
          <DialogDescription className="leading-7">{title}</DialogDescription>
        </DialogHeader>
        {open ? (
          <EditForm plan={plan} habit={habit} today={today} amountLabel={amountLabel} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ plan, habit, today, amountLabel, onDone }: Omit<HabitEditDialogProps, 'open' | 'onOpenChange' | 'title'> & { onDone: () => void }) {
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
  const paused = isPaused(plan);

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
    onDone();
  }

  function togglePause() {
    updateStore((store) => updatePlan(store, plan.id, (p) => (paused ? resumePlan(p, today) : pausePlan(p, today))));
    toast.success(paused ? t('resumed') : t('paused'));
    onDone();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pe-1">
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
        <ActionPair>
          <Button onClick={save}>{t('save')}</Button>
          <Button variant="outline" tone="neutral" onClick={onDone}>
            {t('cancel')}
          </Button>
        </ActionPair>
        <Button variant="ghost" tone="neutral" size="sm" className="self-start" icon={paused ? <Play aria-hidden /> : <Pause aria-hidden />} onClick={togglePause}>
          {paused ? t('resume') : t('pause')}
        </Button>
      </div>
    </div>
  );
}
