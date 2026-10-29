'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { MoonStar, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { z } from '@/lib/zod';
import { MUHASABA_ANSWER_MAX, NIYYAH_NOTE_MAX, type MuhasabaQuestion } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * The hub's tazkiya cards (docs/plan/2026-10-tazkiya-tracker-proposals.md items 5 and 6), presentational only:
 * «نيّتي اليوم», «محاسبة المساء» and the fresh-start note. Every guidance word arrives from the catalog; the
 * buttons' chrome from the messages. No counters, no streaks.
 */
export interface NiyyahChoice {
  planId: string;
  title: string;
}

function CardHead({ icon, title }: { icon: 'sun' | 'moon'; title: string }) {
  const Icon = icon === 'sun' ? Sun : MoonStar;
  return (
    <h2 className="flex items-center gap-2 text-lg font-medium">
      <Icon className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
      {title}
    </h2>
  );
}

interface NiyyahCardProps {
  intro: string;
  choices: NiyyahChoice[];
  onSave: (choice: NiyyahChoice, note: string) => void;
  onNotNow: () => void;
}

/** «نيّتي اليوم»: one of today's habits, an optional short line, «احفظ نيّتي». */
export function NiyyahCard({ intro, choices, onSave, onNotNow }: NiyyahCardProps) {
  const t = useTranslations('tazkiya');
  const schema = useMemo(
    () => z.object({ planId: z.string().min(1), note: z.string().trim().max(NIYYAH_NOTE_MAX, t('tooLong')) }),
    [t],
  );
  const form = useForm<{ planId: string; note: string }>({
    resolver: zodResolver(schema),
    defaultValues: { planId: choices.length === 1 ? (choices[0]?.planId ?? '') : '', note: '' },
  });
  const planId = useWatch({ control: form.control, name: 'planId' });

  function handleSubmit(values: { planId: string; note: string }) {
    const choice = choices.find((c) => c.planId === values.planId);
    if (choice) onSave(choice, values.note);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-label={t('niyyahTitle')}>
      <CardHead icon="sun" title={t('niyyahTitle')} />
      <p className="text-sm leading-7 text-muted-foreground">{intro}</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-3" noValidate>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t('niyyahChoices')}</legend>
            {choices.map((choice) => (
              <label
                key={choice.planId}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors duration-150',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                  planId === choice.planId ? 'border-primary bg-muted font-medium text-primary' : 'border-border hover:bg-muted',
                )}
              >
                <input type="radio" value={choice.planId} className="sr-only" {...form.register('planId')} />
                {choice.title}
              </label>
            ))}
          </fieldset>
          {planId ? (
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('niyyahNoteLabel')}</FormLabel>
                  <FormControl>
                    <Input maxLength={NIYYAH_NOTE_MAX} autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="solid-button button-wrap" disabled={!planId}>
              {t('niyyahSave')}
            </button>
            <Button variant="ghost" tone="neutral" size="sm" onClick={onNotNow}>
              {t('notNow')}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}

type EveningValues = Record<MuhasabaQuestion, string> & { thanked: boolean };

interface EveningCardProps {
  intro: string;
  thanks: string;
  questions: { key: MuhasabaQuestion; text: string }[];
  onSave: (answers: Partial<Record<MuhasabaQuestion, string>>, thanked: boolean) => void;
  onNotNow: () => void;
}

/** «محاسبة المساء»: three optional answers in one card, «احفظ في الدفتر», and the one-tap thanks. */
export function EveningCard({ intro, thanks, questions, onSave, onNotNow }: EveningCardProps) {
  const t = useTranslations('tazkiya');
  const schema = useMemo(() => {
    const answer = z.string().trim().max(MUHASABA_ANSWER_MAX, t('tooLong'));
    // `thanked` is set by the button that submits: the thanks needs no answer.
    return z
      .object({ helped: answer, away: answer, tomorrow: answer, thanked: z.boolean() })
      .refine((v) => v.thanked || [v.helped, v.away, v.tomorrow].some((a) => a !== ''), { message: t('needAnswer'), path: ['helped'] });
  }, [t]);
  const form = useForm<EveningValues>({
    resolver: zodResolver(schema),
    defaultValues: { helped: '', away: '', tomorrow: '', thanked: false },
  });

  function handleSubmit({ thanked, ...answers }: EveningValues) {
    onSave(answers, thanked);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-label={t('eveningTitle')}>
      <CardHead icon="moon" title={t('eveningTitle')} />
      <p className="text-sm leading-7 text-muted-foreground">{intro}</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-3" noValidate>
          {questions.map((q) => (
            <FormField
              key={q.key}
              control={form.control}
              name={q.key}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{q.text}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} maxLength={MUHASABA_ANSWER_MAX} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="solid-button button-wrap" onClick={() => form.setValue('thanked', false)}>
              {t('eveningSave')}
            </button>
            <button type="submit" className="outline-button button-wrap" onClick={() => form.setValue('thanked', true)}>
              {thanks}
            </button>
            <Button variant="ghost" tone="neutral" size="sm" onClick={onNotNow}>
              {t('notNow')}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}

type Href = Parameters<typeof Link>[0]['href'];

interface FreshStartCardProps {
  title: string;
  body: string;
  renewLabel: string;
  /** Opens the intention when today has a habit and no intention yet. */
  onRenew?: () => void;
  /** «زِد خطوة» (the plan's own increase offer) or «ابدأ عادة صغيرة». */
  step?: { label: string; href: Href };
  onNotNow: () => void;
}

/** A quiet fresh start (Hijri month, Friday, Monday, the ten days, Sha'ban): one note, never a notification. */
export function FreshStartCard({ title, body, renewLabel, onRenew, step, onNotNow }: FreshStartCardProps) {
  const t = useTranslations('tazkiya');
  return (
    <aside className="next-step !mt-0 flex flex-col gap-2" aria-label={title}>
      <strong>{title}</strong>
      <p className="!mt-0">{body}</p>
      {onRenew ? null : <p className="!mt-0 text-sm font-medium text-primary">{renewLabel}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {onRenew ? (
          <button type="button" className="outline-button button-wrap" onClick={onRenew}>
            {renewLabel}
          </button>
        ) : null}
        {step ? (
          <Link href={step.href} className="outline-button button-wrap">
            {step.label} <DirectionalArrow />
          </Link>
        ) : null}
        <Button variant="ghost" tone="neutral" size="sm" onClick={onNotNow}>
          {t('notNow')}
        </Button>
      </div>
    </aside>
  );
}
