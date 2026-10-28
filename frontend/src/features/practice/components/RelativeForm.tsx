'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { createRelative, looksLikeContactDetails, MAX_NAME_LENGTH, upsertRelative } from '@thekra/practice-core';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { newUuid } from '@/lib/practice/ids';
import { updateStore } from '@/lib/practice/local-store';
import { DEFAULT_WEEKDAY, RHYTHMS, rhythmRule, type Rhythm } from '@/lib/practice/kinship';
import { z } from '@/lib/zod';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

interface RelativeFormProps {
  today: string;
}

/** Nickname-only relative: contact details are refused (practice-core `looksLikeContactDetails`). */
export function RelativeForm({ today }: RelativeFormProps) {
  const t = useTranslations('practice.kinship.form');
  const tDays = useTranslations('practice.weekdays');
  const schema = useMemo(() => {
    const noContact = (value: string) => !looksLikeContactDetails(value);
    return z.object({
      name: z
        .string()
        .trim()
        .min(1, t('errors.nameRequired'))
        .max(MAX_NAME_LENGTH, t('errors.nameLong'))
        .refine(noContact, t('errors.contact')),
      relation: z.string().trim().max(MAX_NAME_LENGTH, t('errors.nameLong')).refine(noContact, t('errors.contact')),
      rhythm: z.enum(RHYTHMS),
      weekday: z.string(),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', relation: '', rhythm: 'weekly', weekday: String(DEFAULT_WEEKDAY) },
  });
  const rhythm = useWatch({ control: form.control, name: 'rhythm' });

  function handleSubmit(values: Values) {
    const relative = createRelative({
      id: newUuid(),
      name: values.name,
      relation: values.relation,
      rule: rhythmRule(values.rhythm as Rhythm, Number(values.weekday), today),
    });
    updateStore((store) => upsertRelative(store, relative));
    form.reset({ ...values, name: '', relation: '' });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
        noValidate
      >
        <h2 className="text-xl font-medium">{t('title')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('name')}</FormLabel>
                <FormControl>
                  <Input autoComplete="off" maxLength={MAX_NAME_LENGTH} {...field} />
                </FormControl>
                <FormDescription>{t('nameHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="relation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('relation')}</FormLabel>
                <FormControl>
                  <Input autoComplete="off" maxLength={MAX_NAME_LENGTH} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rhythm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('rhythm')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RHYTHMS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`rhythms.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>{t('rhythmHint')}</FormDescription>
              </FormItem>
            )}
          />
          {rhythm !== 'monthly' ? (
            <FormField
              control={form.control}
              name="weekday"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('weekday')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {tDays(`d${day}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          ) : null}
        </div>
        <button type="submit" className="solid-button button-wrap self-start">
          {t('submit')}
        </button>
      </form>
    </Form>
  );
}
