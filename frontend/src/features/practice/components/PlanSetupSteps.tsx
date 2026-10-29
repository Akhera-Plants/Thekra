'use client';

import { useWatch, type Control } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { loadWarning, type Plan } from '@thekra/practice-core';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PracticeHabit } from '@/lib/types/practice';
import { z } from '@/lib/zod';
import { amountLabel } from './amount-label';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ACTIVE_DAYS = [2, 3, 4, 5, 6, 7];

/** The setup form: per-habit distance, two reminder times and active days; free minutes a day. */
export function makeSetupSchema(messages: { time: string; minutes: string }) {
  return z.object({
    plans: z.record(
      z.string(),
      z.object({
        distance: z.enum(['far', 'near']),
        slot1: z.string().regex(TIME, messages.time),
        slot2: z.string().regex(TIME, messages.time).or(z.literal('')),
        activeDays: z.string(),
      }),
    ),
    freeMinutes: z
      .string()
      .regex(/^\d{1,4}$/, messages.minutes)
      .refine((value) => Number(value) <= 1440, messages.minutes),
  });
}

export type SetupValues = z.infer<ReturnType<typeof makeSetupSchema>>;
type SetupControl = Control<SetupValues>;

export function HabitShape({ habit, control }: { habit: PracticeHabit; control: SetupControl }) {
  const t = useTranslations('practice.setup');
  const locale = useLocale();
  const english = locale === 'en';
  const base = `plans.${habit.key}` as const;
  const label = english ? habit.unitLabelEn : habit.unitLabelAr;
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <legend className="px-1 text-lg font-medium">{english ? habit.titleEn : habit.titleAr}</legend>
      <FormField
        control={control}
        name={`${base}.distance`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('distanceQuestion')}</FormLabel>
            <div className="flex flex-col gap-2" role="radiogroup">
              {(['far', 'near'] as const).map((distance) => (
                <label key={distance} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    className="size-4 accent-primary"
                    name={field.name}
                    value={distance}
                    checked={field.value === distance}
                    onChange={() => field.onChange(distance)}
                  />
                  <span>
                    {t(distance)} — {t('startWith', { amount: amountLabel(habit.start[distance], habit.unit, label, english, habit.rakah) })}
                  </span>
                </label>
              ))}
            </div>
          </FormItem>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {(['slot1', 'slot2'] as const).map((slot, index) => (
          <FormField
            key={slot}
            control={control}
            name={`${base}.${slot}`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('slot', { n: String(index + 1) })}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} value={String(field.value ?? '')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <FormField
          control={control}
          name={`${base}.activeDays`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('activeDays')}</FormLabel>
              <Select value={String(field.value)} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ACTIVE_DAYS.map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {t('daysPerWeek', { n: String(days) })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>
      <p className="text-sm leading-7 text-muted-foreground">{t('shapeHint')}</p>
    </fieldset>
  );
}

interface RolesStepProps {
  control: SetupControl;
  existing: readonly Plan[];
  build: () => Plan[];
  onBack: () => void;
}

/** «فروضي وأدواري»: obligations first; nawafil must not take more than half of the free time. */
export function RolesStep({ control, existing, build, onBack }: RolesStepProps) {
  const t = useTranslations('practice.setup');
  const raw = useWatch({ control, name: 'freeMinutes' });
  const minutes = Number(raw);
  const warning = Number.isFinite(minutes) && minutes >= 0 ? loadWarning([...existing, ...build()], minutes) : 'ok';
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-medium">{t('rolesTitle')}</h2>
      <p className="text-muted-foreground">{t('rolesLead')}</p>
      <FormField
        control={control}
        name="freeMinutes"
        render={({ field }) => (
          <FormItem className="max-w-xs">
            <FormLabel>{t('freeMinutes')}</FormLabel>
            <FormControl>
              <Input type="number" inputMode="numeric" min={0} max={1440} step={5} {...field} value={String(field.value ?? '')} />
            </FormControl>
            <FormDescription>{t('freeMinutesHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {warning === 'over' ? (
        <p className="next-step" role="status">
          {t('loadOver')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="solid-button button-wrap">
          {t('create')} <DirectionalArrow />
        </button>
        <button type="button" className="outline-button button-wrap" onClick={onBack}>
          {t('back')}
        </button>
      </div>
    </div>
  );
}
