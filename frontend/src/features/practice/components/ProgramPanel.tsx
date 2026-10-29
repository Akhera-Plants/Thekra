'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { afterFall, checkIn, CHECK_IN_VALUES, endProgram, type CheckInValue, type SinProgram } from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateStore } from '@/lib/practice/local-store';
import { programView, SUMMARY_DAYS } from '@/lib/practice/programs';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeHabit, SinProgramCommon, SinProgramEntry } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { z } from '@/lib/zod';
import { EvidenceQuotes } from './EvidenceQuotes';

const MAX_NOTE = 500;

interface ProgramPanelProps {
  program: SinProgram;
  entry: SinProgramEntry;
  common: SinProgramCommon;
  name: string | undefined;
  habits: ReadonlyMap<string, PracticeHabit>;
  /** Every program's evidence, fetched once for all (the request never names this program). */
  quotes: readonly QuoteDto[];
  today: string;
}

/** One program: stage, steps, alternatives, texts, the day's private check-in, after-fall help, counts. */
export function ProgramPanel({ program, entry, common, name, habits, quotes, today }: ProgramPanelProps) {
  const t = useTranslations('leaveSin.program');
  const english = useLocale() === 'en';
  const view = programView(program, today);
  const stage = common.stages[view.stage];
  const steps = english ? entry.gradualStepsEn : entry.gradualStepsAr;
  const actions = english ? entry.actionsEn : entry.actionsAr;
  const fell = view.today?.value === 'fell_repented' && afterFall(program) === 'fixit';

  return (
    <article className="flex flex-col gap-8" aria-labelledby={`program-${program.sinSlug}`}>
      <header className="flex flex-col gap-2">
        <h2 id={`program-${program.sinSlug}`} className="text-2xl font-medium">
          {name ?? t('unnamed')}
        </h2>
        <p className="text-muted-foreground">
          {program.path === 'gradual' ? t('pathGradual') : program.category === 'haqq_ibad' ? t('pathPeople') : t('pathCut')}
        </p>
      </header>

      {program.path === 'gradual' && steps && steps.length > 0 ? (
        <section className="next-step !mt-0 flex flex-col gap-2" aria-label={t('gradualTitle')}>
          <strong>{t('gradualTitle')}</strong>
          <ol className="list-decimal ps-5 leading-8">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby={`stage-${program.sinSlug}`} className="flex flex-col gap-3">
        <p className="eyebrow">{t('stageOf', { n: formatDigits(view.stageIndex + 1), total: formatDigits(view.stageCount) })}</p>
        <h3 id={`stage-${program.sinSlug}`} className="text-xl font-medium">
          {english ? stage.titleEn : stage.titleAr}
        </h3>
        <p className="max-w-3xl text-lg leading-9">{english ? stage.bodyEn : stage.bodyAr}</p>
        <p className="text-sm leading-7 text-muted-foreground">{t('stageRule', { days: formatDigits(common.stageMinDays) })}</p>
        <ol className="flex flex-wrap gap-2" aria-label={t('stagesLabel')}>
          {view.stages.map((key, index) => (
            <li
              key={key}
              aria-current={index === view.stageIndex ? 'step' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                index === view.stageIndex ? 'border-primary text-primary' : 'border-border text-muted-foreground',
              )}
            >
              {english ? common.stages[key].titleEn : common.stages[key].titleAr}
            </li>
          ))}
        </ol>
        {stage.evidence && stage.evidence.length > 0 ? <EvidenceQuotes ids={stage.evidence} quotes={quotes} /> : null}
      </section>

      {actions.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby={`actions-${program.sinSlug}`}>
          <h3 id={`actions-${program.sinSlug}`} className="text-xl font-medium">
            {t('actionsTitle')}
          </h3>
          <ul className="list-disc ps-5 leading-8">
            {actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {entry.alternatives.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby={`alt-${program.sinSlug}`}>
          <h3 id={`alt-${program.sinSlug}`} className="text-xl font-medium">
            {t('alternativesTitle')}
          </h3>
          <p className="text-muted-foreground">{t('alternativesLead')}</p>
          <ul className="flex flex-wrap gap-2">
            {entry.alternatives.flatMap((key) => {
              const habit = habits.get(key);
              return habit
                ? [
                    <li key={key} className="rounded-full border border-border px-3 py-1">
                      {english ? habit.titleEn : habit.titleAr}
                    </li>,
                  ]
                : [];
            })}
          </ul>
          <Link href="/practice" className="text-link self-start">
            {t('alternativesLink')} <DirectionalArrow />
          </Link>
        </section>
      ) : null}

      {entry.help ? <p className="next-step !mt-0">{english ? common.helpEn : common.helpAr}</p> : null}

      <CheckInForm program={program} today={today} />

      {fell ? (
        <section className="flex flex-col gap-3" aria-labelledby={`fall-${program.sinSlug}`}>
          <h3 id={`fall-${program.sinSlug}`} className="text-xl font-medium text-primary">
            {english ? common.afterFall.titleEn : common.afterFall.titleAr}
          </h3>
          <p className="max-w-3xl text-lg leading-9">{english ? common.afterFall.bodyEn : common.afterFall.bodyAr}</p>
          {common.afterFall.evidence ? <EvidenceQuotes ids={common.afterFall.evidence} quotes={quotes} /> : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-2" aria-labelledby={`summary-${program.sinSlug}`}>
        <h3 id={`summary-${program.sinSlug}`} className="text-xl font-medium">
          {t('summaryTitle', { days: formatDigits(SUMMARY_DAYS) })}
        </h3>
        <p className="leading-8">
          {CHECK_IN_VALUES.map((value) =>
            t('summaryItem', { label: t(`values.${value}`), n: formatDigits(view.summary[value]) }),
          ).join(' · ')}
        </p>
        <p className="text-sm text-muted-foreground">{t('summaryNote')}</p>
      </section>

      {view.recent.length > 0 ? <RecentCheckIns recent={view.recent} /> : null}

      <section className="flex flex-col gap-3" aria-labelledby={`texts-${program.sinSlug}`}>
        <h3 id={`texts-${program.sinSlug}`} className="text-xl font-medium">
          {t('textsTitle')}
        </h3>
        <EvidenceQuotes ids={entry.evidence} quotes={quotes} />
      </section>

      <EndProgram program={program} />
    </article>
  );
}

/**
 * «أنهِ هذا البرنامج»: ends this program only. Its check-ins and notes are removed from this device at once, and the
 * encrypted copy follows on the next save (practice-core `endProgram` keeps a marker so the vault does not bring it
 * back). Starting it again later is a fresh program.
 */
function EndProgram({ program }: { program: SinProgram }) {
  const t = useTranslations('leaveSin.program.end');
  function handleConfirm() {
    updateStore((store) => ({
      ...store,
      programs: store.programs.map((p) => (p.sinSlug === program.sinSlug ? endProgram(p) : p)),
    }));
  }
  return (
    <div className="flex flex-col items-start gap-2 border-t border-border pt-4">
      <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="outline-button button-wrap">
            {t('button')}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RecentCheckIns({ recent }: { recent: ReturnType<typeof programView>['recent'] }) {
  const t = useTranslations('leaveSin.program');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer font-medium">{t('notesTitle')}</summary>
      <ul className="mt-3 flex flex-col gap-2">
        {recent.map((c) => (
          <li key={c.date} className="leading-8">
            <span className="text-muted-foreground">{formatGregorian(c.date, locale)}</span> · {t(`values.${c.value}`)}
            {c.note ? <p className="break-words whitespace-pre-line">{c.note}</p> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function CheckInForm({ program, today }: { program: SinProgram; today: string }) {
  const t = useTranslations('leaveSin.checkIn');
  const tValues = useTranslations('leaveSin.program.values');
  const existing = program.checkIns.find((c) => c.date === today);
  const schema = useMemo(
    () =>
      z.object({
        value: z.string().refine((v) => (CHECK_IN_VALUES as readonly string[]).includes(v), t('errors.choose')),
        note: z.string().max(MAX_NOTE, t('errors.noteLong')),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { value: existing?.value ?? '', note: existing?.note ?? '' },
  });

  function handleSubmit(values: Values) {
    const note = values.note.trim();
    updateStore((store) => ({
      ...store,
      programs: store.programs.map((p) =>
        p.sinSlug === program.sinSlug ? checkIn(p, today, values.value as CheckInValue, note || undefined) : p,
      ),
    }));
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
        noValidate
      >
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xl font-medium">{t('title')}</legend>
                {CHECK_IN_VALUES.map((value) => (
                  <label key={value} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      className="size-4 accent-primary"
                      name={field.name}
                      value={value}
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                    />
                    <span>{tValues(value)}</span>
                  </label>
                ))}
              </fieldset>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('note')}</FormLabel>
              <FormControl>
                <Textarea rows={3} maxLength={MAX_NOTE} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="solid-button button-wrap">
            {t('save')}
          </button>
          {existing ? (
            <span className="text-sm text-muted-foreground" role="status">
              {t('saved')}
            </span>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
