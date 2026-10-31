'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { updatePlan, type Plan } from '@thekra/practice-core';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateStore } from '@/lib/practice/local-store';
import { editPlan, lowerAmounts } from '@/lib/practice/plans';
import { z } from '@/lib/zod';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ACTIVE_DAYS = [2, 3, 4, 5, 6, 7];
/** Time fields shown: the plan's times plus one empty field, at least two, at most four. */
const MAX_SLOTS = 4;

interface PlanEditFormProps {
  plan: Plan;
  today: string;
  /** The amount in the page language, e.g. «5 دقيقة». */
  amountLabel: (n: number) => string;
  onDone: () => void;
}

/**
 * «تعديل»: reminder times, active days a week, and a lower everyday amount (practice-core `decreaseTo` through
 * `editPlan`). Going up stays with the one-step rule on the card. Saved through `updatePlan`, so the edit syncs.
 */
export function PlanEditForm({ plan, today, amountLabel, onDone }: PlanEditFormProps) {
  const t = useTranslations('practice.today');
  const tSetup = useTranslations('practice.setup');
  const fieldCount = Math.min(MAX_SLOTS, Math.max(2, plan.slots.length + 1));
  const amounts = useMemo(() => lowerAmounts(plan), [plan]);
  const schema = useMemo(
    () =>
      z.object({
        slots: z
          .array(z.string().regex(TIME, tSetup('errors.time')).or(z.literal('')))
          .refine((slots) => slots.some(Boolean), t('editSlotsRequired')),
        activeDays: z.string(),
        amount: z.string(),
      }),
    [t, tSetup],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      slots: Array.from({ length: fieldCount }, (_, i) => plan.slots[i] ?? ''),
      activeDays: String(plan.activeDaysPerWeek),
      amount: String(amounts[0]),
    },
  });

  function handleSubmit(values: Values) {
    const edit = {
      slots: values.slots.filter(Boolean),
      activeDaysPerWeek: Number(values.activeDays),
      amount: Number(values.amount),
    };
    updateStore((store) => updatePlan(store, plan.id, (p) => editPlan(p, edit, today)));
    onDone();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-4 rounded-xl border border-border p-4"
        noValidate
        aria-label={t('editTitle')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: fieldCount }, (_, index) => (
            <FormField
              key={index}
              control={form.control}
              name={`slots.${index}`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tSetup('slot', { n: String(index + 1) })}</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        <FormField
          control={form.control}
          name="slots"
          render={() => (
            <FormItem>
              <FormDescription>{t('editSlotsHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="activeDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{tSetup('activeDays')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACTIVE_DAYS.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {tSetup('daysPerWeek', { n: String(days) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('editAmount')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {amounts.map((amount) => (
                      <SelectItem key={amount} value={String(amount)}>
                        {amountLabel(amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{t('editAmountHint')}</p>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="solid-button button-wrap">
            {t('editSave')}
          </button>
          <button type="button" className="outline-button button-wrap" onClick={onDone}>
            {t('editCancel')}
          </button>
        </div>
      </form>
    </Form>
  );
}
