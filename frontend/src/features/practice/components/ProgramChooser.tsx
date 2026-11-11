'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { programEntryFor, startProgram, type SinProgram } from '@thekra/practice-core';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { formatDigits } from '@/lib/format/digits';
import { cn } from '@/lib/utils';
import { TOPIC_DOMAINS } from '@/lib/topic-domains';
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { updateStore } from '@/lib/practice/local-store';
import { chosenPath } from '@/lib/practice/programs';
import { groupSinsForChooser, type SinOption } from '@/lib/practice/sin-choice';
import type { SinProgramCommon, SinProgramEntry } from '@/lib/types/practice';
import { z } from '@/lib/zod';

const DOMAIN_ORDER = TOPIC_DOMAINS.map((domain) => domain.key);

interface ProgramChooserProps {
  /** The written programs (sin-programs.yaml). Any other sin starts the common one ({@link programEntryFor}). */
  entries: readonly SinProgramEntry[];
  common: SinProgramCommon;
  /** Every sin of the public list (the same request for every visitor). */
  sins: readonly SinOption[];
  /** Display name per sin slug, in the page's language. */
  names: ReadonlyMap<string, string>;
  /** Slug handed over from a sin page (never via the URL). */
  preselected: string | null;
  today: string;
  /** Called after the program is saved. */
  onDone: () => void;
  /**
   * Takes the new program instead of saving it here: the «تخفَّف» page first asks for the privacy code when the
   * account has no vault yet, then saves it.
   */
  onStart?: (program: SinProgram) => void;
  onCancel?: () => void;
}

/**
 * «تخفَّف من ذنب» for any sin (owner, 2026-11-01): choose the sin (grouped and searchable), answer one question, start.
 * A sin with a written program may ask the willpower question; any other sin asks «هل فيها حقٌّ لأحد من الناس؟» and
 * starts the common five stages. Saved in the account, encrypted (the page seals it).
 */
export function ProgramChooser({ entries, common, sins, names, preselected, today, onDone, onCancel, onStart }: ProgramChooserProps) {
  const t = useTranslations('leaveSin.choose');
  const locale = useLocale();
  const english = locale === 'en';
  const searchId = useId();
  const schema = useMemo(
    () =>
      z
        .object({ sin: z.string().min(1, t('errors.choose')), veryHard: z.enum(['yes', 'no', '']), people: z.enum(['yes', 'no', '']) })
        .refine((v) => !v.sin || entries.some((e) => e.sin === v.sin) || v.people !== '', {
          message: t('errors.category'),
          path: ['people'],
        }),
    [t, entries],
  );
  type Values = z.infer<typeof schema>;
  const initial = preselected && names.has(preselected) ? preselected : '';
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { sin: initial, veryHard: '', people: '' } });
  const sin = useWatch({ control: form.control, name: 'sin' });
  const people = useWatch({ control: form.control, name: 'people' });
  const [browsing, setBrowsing] = useState(initial === '');
  const [query, setQuery] = useState('');
  // W-29: the groups fold on the page itself (no box with its own scroll). The group of a chosen sin starts open.
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = (key: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const groups = useMemo(() => groupSinsForChooser(sins, query, DOMAIN_ORDER), [sins, query]);
  const written = entries.find((e) => e.sin === sin);
  const category = people === 'yes' ? 'haqq_ibad' : people === 'no' ? 'haqq_allah' : null;
  const entry = sin ? programEntryFor(entries, sin, category) : null;

  function domainLabel(key: string | null): string {
    const domain = TOPIC_DOMAINS.find((item) => item.key === key);
    return domain ? (english ? domain.en : domain.ar) : t('otherGroup');
  }

  function handleSubmit(values: Values) {
    const chosen = programEntryFor(
      entries,
      values.sin,
      values.people === 'yes' ? 'haqq_ibad' : values.people === 'no' ? 'haqq_allah' : null,
    );
    if (!chosen) return;
    const path = chosenPath(chosen, values.veryHard === 'yes');
    const program = startProgram({
      sinSlug: chosen.sin,
      category: chosen.category,
      hardToLeaveAtOnce: path === 'gradual',
      startedOn: today,
    });
    if (onStart) {
      onStart(program);
      return;
    }
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
                {!browsing && field.value ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary bg-card p-4">
                    <span className="flex-1 text-lg font-medium">{names.get(field.value) ?? t('unnamed')}</span>
                    <Button variant="outline" tone="primary" size="sm" onClick={() => setBrowsing(true)}>
                      {t('change')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id={searchId}
                        type="search"
                        aria-label={t('search')}
                        placeholder={t('search')}
                        className="h-11 ps-9"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </div>
                    <div className="flex flex-col divide-y divide-border border-b border-border">
                      {groups.length === 0 ? <p className="p-2 text-muted-foreground">{t('noMatch')}</p> : null}
                      {groups.map((group) => {
                        const key = group.domain ?? 'other';
                        const titled = groups.length > 1 || Boolean(group.domain);
                        // A search shows every match; a lone group has nothing to fold.
                        const open =
                          !titled || query.trim() !== '' || openGroups.has(key) || group.sins.some((option) => option.slug === field.value);
                        const panelId = `${searchId}-${key}`;
                        return (
                          <div key={key} className="flex flex-col">
                            {titled ? (
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-controls={panelId}
                                onClick={() => toggleGroup(key)}
                                className="flex min-h-12 items-center justify-between gap-3 py-2 text-start text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              >
                                <span>{domainLabel(group.domain)}</span>
                                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {formatDigits(group.sins.length)}
                                  <ChevronDown aria-hidden className={cn('size-4 motion-safe:transition-transform', open && 'rotate-180')} />
                                </span>
                              </button>
                            ) : null}
                            <ul id={panelId} hidden={!open} className="grid gap-2 pb-3 sm:grid-cols-2">
                              {group.sins.map((option) => (
                                <li key={option.slug}>
                                  <label className="flex h-full min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 has-[:checked]:border-primary has-[:focus-visible]:border-primary">
                                    <input
                                      type="radio"
                                      className="size-4 shrink-0 accent-primary"
                                      name={field.name}
                                      value={option.slug}
                                      checked={field.value === option.slug}
                                      onChange={() => {
                                        field.onChange(option.slug);
                                        form.setValue('people', '');
                                        form.setValue('veryHard', '');
                                      }}
                                    />
                                    <span className="text-base">{names.get(option.slug) ?? option.nameAr}</span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </fieldset>
              <FormMessage />
            </FormItem>
          )}
        />

        {sin && !written ? (
          <FormField
            control={form.control}
            name="people"
            render={({ field }) => (
              <FormItem>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-lg font-medium">{t('categoryQuestion')}</legend>
                  {(['yes', 'no'] as const).map((answer) => (
                    <label key={answer} className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        className="size-4 accent-primary"
                        name={field.name}
                        value={answer}
                        checked={field.value === answer}
                        onChange={() => field.onChange(answer)}
                      />
                      <span>{t(answer === 'yes' ? 'categoryYes' : 'categoryNo')}</span>
                    </label>
                  ))}
                </fieldset>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {written?.gradualAllowed ? (
          <FormField
            control={form.control}
            name="veryHard"
            render={({ field }) => (
              <FormItem>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-lg font-medium">{english ? common.willQuestionEn : common.willQuestionAr}</legend>
                  {(['yes', 'no'] as const).map((answer) => (
                    <label key={answer} className="flex min-h-11 cursor-pointer items-center gap-3">
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

        {/* «ابدأ» stays in reach at the bottom of the screen once a sin is chosen (W-29). */}
        <div
          className={cn(
            sin &&
              'sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85',
          )}
        >
          <ActionPair layout="hug">
            <Button type="submit" variant="solid" tone="primary" size="md">
              {t('start')} <DirectionalArrow />
            </Button>
            {onCancel ? (
              <Button type="button" variant="outline" tone="neutral" size="md" onClick={onCancel}>
                {t('cancel')}
              </Button>
            ) : null}
          </ActionPair>
        </div>
      </form>
    </Form>
  );
}
