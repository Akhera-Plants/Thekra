'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { startProgram } from '@thekra/practice-core';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { updateStore } from '@/lib/practice/local-store';
import { chosenPath } from '@/lib/practice/programs';
import type { SinProgramCommon, SinProgramEntry } from '@/lib/types/practice';
import { z } from '@/lib/zod';

interface ProgramChooserProps {
  entries: readonly SinProgramEntry[];
  common: SinProgramCommon;
  /** Display name per sin slug, from the public sin list. */
  names: ReadonlyMap<string, string>;
  /** Slug handed over from a sin page (never via the URL). */
  preselected: string | null;
  today: string;
  /** Called after the program is saved. */
  onDone: () => void;
  onCancel?: () => void;
}

/** Choose a program, answer the willpower question, start. Saved on this device only. */
export function ProgramChooser({ entries, common, names, preselected, today, onDone, onCancel }: ProgramChooserProps) {
  const t = useTranslations('leaveSin.choose');
  const locale = useLocale();
  const schema = useMemo(
    () => z.object({ sin: z.string().min(1, t('errors.choose')), veryHard: z.enum(['yes', 'no', '']) }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const initial = preselected && entries.some((entry) => entry.sin === preselected) ? preselected : '';
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { sin: initial, veryHard: '' } });
  const sin = useWatch({ control: form.control, name: 'sin' });
  const entry = entries.find((e) => e.sin === sin);

  function handleSubmit(values: Values) {
    const chosen = entries.find((e) => e.sin === values.sin);
    if (!chosen) return;
    const path = chosenPath(chosen, values.veryHard === 'yes');
    const program = startProgram({
      sinSlug: chosen.sin,
      category: chosen.category,
      hardToLeaveAtOnce: path === 'gradual',
      startedOn: today,
    });
    updateStore((store) => ({ ...store, programs: [...store.programs.filter((p) => p.sinSlug !== chosen.sin), program] }));
    onDone();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6" noValidate>
        <FormField
          control={form.control}
          name="sin"
          render={({ field }) => (
            <FormItem>
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-2xl font-medium">{t('title')}</legend>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {entries.map((e) => (
                    <li key={e.sin}>
                      <label className="flex h-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 has-[:checked]:border-primary has-[:focus-visible]:border-primary">
                        <input
                          type="radio"
                          className="size-4 shrink-0 accent-primary"
                          name={field.name}
                          value={e.sin}
                          checked={field.value === e.sin}
                          onChange={() => field.onChange(e.sin)}
                        />
                        <span className="text-lg font-medium">{names.get(e.sin) ?? t('unnamed')}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <FormMessage />
            </FormItem>
          )}
        />

        {entry?.gradualAllowed ? (
          <FormField
            control={form.control}
            name="veryHard"
            render={({ field }) => (
              <FormItem>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-lg font-medium">
                    {locale === 'en' ? common.willQuestionEn : common.willQuestionAr}
                  </legend>
                  {(['yes', 'no'] as const).map((answer) => (
                    <label key={answer} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        className="size-4 accent-primary"
                        name={field.name}
                        value={answer}
                        checked={field.value === answer}
                        onChange={() => field.onChange(answer)}
                      />
                      <span>{t(answer === 'yes' ? 'veryHardYes' : 'veryHardNo')}</span>
                    </label>
                  ))}
                </fieldset>
              </FormItem>
            )}
          />
        ) : entry ? (
          <p className="next-step !mt-0">{entry.category === 'haqq_ibad' ? t('peopleRights') : t('cutOnly')}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="solid-button button-wrap">
            {t('start')} <DirectionalArrow />
          </button>
          {onCancel ? (
            <button type="button" className="outline-button button-wrap" onClick={onCancel}>
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
