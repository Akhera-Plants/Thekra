'use client';

import { useId, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { addDays, correctLog, updatePlan, type Plan } from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatGregorian } from '@/lib/practice/format';
import { updateStore } from '@/lib/practice/local-store';
import { z } from '@/lib/zod';

/** How far back a forgotten day can be logged or fixed. */
export const EDITABLE_DAYS = 7;
const MAX_LOG = 1000;

/** Today first, then back {@link EDITABLE_DAYS} days, never before the plan started. */
export function editableDays(plan: Plan, today: string): string[] {
  const days: string[] = [];
  for (let i = 0; i < EDITABLE_DAYS; i++) {
    const day = addDays(today, -i);
    if (day < plan.createdOn) break;
    days.push(day);
  }
  return days;
}

interface LogEditorProps {
  plan: Plan;
  today: string;
  unit: string;
  onDone: () => void;
}

/**
 * «صحّح السجل»: sets the amount of one recent day (0 clears it). Uses practice-core `correctLog`, so the fix also
 * wins over the old amount on the user's other devices.
 */
export function LogEditor({ plan, today, unit, onDone }: LogEditorProps) {
  const t = useTranslations('practice.today.editLog');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const dateId = useId();
  const days = editableDays(plan, today);
  const [date, setDate] = useState(today);
  const current = plan.log[date] ?? 0;
  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .regex(/^\d+$/, t('error'))
          .refine((value) => Number(value) <= MAX_LOG, t('error')),
      }),
    [t],
  );
  const form = useForm<{ amount: string }>({ resolver: zodResolver(schema), defaultValues: { amount: String(current) } });

  function pickDate(next: string) {
    setDate(next);
    form.reset({ amount: String(plan.log[next] ?? 0) });
  }

  function handleSubmit(values: { amount: string }) {
    updateStore((store) => updatePlan(store, plan.id, (p) => correctLog(p, date, Number(values.amount))));
    onDone();
  }

  const dayLabel = (day: string) =>
    day === today ? t('today') : day === addDays(today, -1) ? t('yesterday') : formatGregorian(day, locale, true);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-sm leading-7 text-muted-foreground">{t('hint')}</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-wrap items-end gap-3" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor={dateId}>{t('day')}</Label>
            <Select value={date} onValueChange={pickDate}>
              <SelectTrigger id={dateId} className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day} value={day}>
                    {dayLabel(day)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className="w-36">
                <FormLabel>{t('amount', { unit })}</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={0} step={1} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="outline-button button-wrap">
              {t('save')}
            </button>
            <Button type="button" variant="ghost" tone="neutral" size="sm" onClick={onDone}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
