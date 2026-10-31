'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import {
  afterFall,
  annotateCheckIn,
  checkIn,
  CHECK_IN_VALUES,
  endProgram,
  hasTriggers,
  heldDaysTotal,
  hopeTextFor,
  shortestTextId,
  limitForToday,
  programCounters,
  STAGE_TASKS,
  stageTrack,
  suggestedLimit,
  weakPattern,
  type CheckInValue,
  type SinProgram,
  type Triggers,
} from '@thekra/practice-core';
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
import { programTextIds, programView } from '@/lib/practice/programs';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeHabit, SinProgramCommon, SinProgramEntry } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { z } from '@/lib/zod';
import { useLimitLabel } from '../hooks/useLimitLabel';
import { useSinVault } from '../hooks/useSinVault';
import { EvidenceQuotes } from './EvidenceQuotes';
import { FixItSheet } from './FixItSheet';
import { StoryLine } from './hub/KnowledgeCards';
import { TriggerChips } from './TriggerChips';

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
  const tLimits = useTranslations('leaveSin.limits');
  const tCounters = useTranslations('leaveSin.counters');
  const tTally = useTranslations('practice.tally');
  const tStages = useTranslations('leaveSin.stages');
  const tFix = useTranslations('leaveSin.fixit');
  const limitLabel = useLimitLabel(actions);
  const [fixOpen, setFixOpen] = useState(false);
  const counters = programCounters(program, today);
  const todayLimit = limitForToday(program, today);
  const todayLimitText = todayLimit ? limitLabel(todayLimit) : null;
  const track = stageTrack(program, today);
  const afterFallIds = common.afterFall.evidence ?? [];
  const hopeId = fell ? hopeTextFor(afterFallIds, quotes, today, shortestTextId(afterFallIds, quotes)) : null;

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

      {todayLimitText ? <p className="next-step !mt-0">{tLimits('today', { limit: todayLimitText })}</p> : null}

      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-lg font-medium">
          <span>{tCounters('held', { n: formatDigits(counters.held), total: formatDigits(counters.window) })}</span>
          <span className="text-muted-foreground">
            {tCounters(counters.fromStart ? 'sinceStart' : 'sinceRepentance', {
              count: counters.daysSinceRepentance,
              n: formatDigits(counters.daysSinceRepentance),
            })}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">{tCounters('note')}</p>
        {/* «حصيلتي» of this program: only here, inside its locked page. */}
        <p className="text-sm text-muted-foreground">
          {tTally('heldTotal', { count: heldDaysTotal(program, today), n: formatDigits(heldDaysTotal(program, today)) })}
        </p>
      </div>

      {/* After a fall: the story of the man who killed a hundred, by id only (hidden until the id is filled). */}
      {fell ? <StoryLine moment="afterFall" /> : null}

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
        <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label={tStages('track')}>
          {track.map(({ stage: key, state }, index) => (
            <li
              key={key}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex min-w-0 shrink-0 items-center gap-1"
            >
              {index > 0 ? <span className={cn('h-px w-4', state === 'next' ? 'bg-border' : 'bg-primary')} aria-hidden /> : null}
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap',
                  state === 'current' && 'border-primary bg-primary text-primary-foreground',
                  state === 'done' && 'border-primary text-primary',
                  state === 'next' && 'border-border text-muted-foreground',
                )}
              >
                {state === 'done' ? <Check className="size-3" aria-hidden /> : null}
                <span className="sr-only">{tStages(state)}: </span>
                {english ? common.stages[key].titleEn : common.stages[key].titleAr}
              </span>
            </li>
          ))}
        </ol>
        <p className="eyebrow">{t('stageOf', { n: formatDigits(view.stageIndex + 1), total: formatDigits(view.stageCount) })}</p>
        <h3 id={`stage-${program.sinSlug}`} className="text-xl font-medium">
          {english ? stage.titleEn : stage.titleAr}
        </h3>
        <p className="max-w-3xl text-lg leading-9">{english ? stage.bodyEn : stage.bodyAr}</p>
        <div className="next-step !mt-0 flex flex-col gap-1">
          <strong>{tStages('taskTitle')}</strong>
          <span>{tStages(`tasks.${STAGE_TASKS[view.stage]}`)}</span>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{t('stageRule', { days: formatDigits(common.stageMinDays) })}</p>
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
          <Link href={{ pathname: '/practice/habits', query: { add: '1' } }} className="text-link self-start">
            {t('alternativesLink')} <DirectionalArrow />
          </Link>
        </section>
      ) : null}

      {entry.help ? <p className="next-step !mt-0">{english ? common.helpEn : common.helpAr}</p> : null}

      <CheckInForm program={program} today={today} onFell={() => setFixOpen(true)} />

      {fell ? (
        <section className="flex flex-col gap-3" aria-labelledby={`fall-${program.sinSlug}`}>
          <h3 id={`fall-${program.sinSlug}`} className="text-xl font-medium text-primary">
            {english ? common.afterFall.titleEn : common.afterFall.titleAr}
          </h3>
          <p className="max-w-3xl text-lg leading-9">{english ? common.afterFall.bodyEn : common.afterFall.bodyAr}</p>
          {hopeId ? (
            <div aria-label={tCounters('hope')} role="group">
              <EvidenceQuotes ids={[hopeId]} quotes={quotes} />
            </div>
          ) : null}
          <button type="button" className="solid-button button-wrap self-start" onClick={() => setFixOpen(true)}>
            {tFix('open')}
          </button>
        </section>
      ) : null}
      <FixItSheet
        open={fixOpen}
        onOpenChange={setFixOpen}
        program={program}
        entry={entry}
        common={common}
        habits={habits}
        quotes={quotes}
        today={today}
      />

      <WeakPatternCard program={program} actions={actions} />

      {view.recent.length > 0 ? <RecentCheckIns recent={view.recent} /> : null}

      <section className="flex flex-col gap-3" aria-labelledby={`texts-${program.sinSlug}`}>
        <h3 id={`texts-${program.sinSlug}`} className="text-xl font-medium">
          {t('textsTitle')}
        </h3>
        <EvidenceQuotes ids={programTextIds(entry, common, view.stage)} quotes={quotes} />
      </section>

      <EndProgram program={program} />
    </article>
  );
}

/** «متى تضعف؟»: derived on this device from the trigger chips; shown after 14 tagged check-ins, never sent. */
function WeakPatternCard({ program, actions }: { program: SinProgram; actions: readonly string[] }) {
  const t = useTranslations('leaveSin.pattern');
  const tTriggers = useTranslations('leaveSin.triggers');
  const limitLabel = useLimitLabel(actions);
  const pattern = weakPattern(program);
  if (!pattern) return null;
  const limit = limitLabel(suggestedLimit(pattern, actions.length));
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5" aria-labelledby={`pattern-${program.sinSlug}`}>
      <h3 id={`pattern-${program.sinSlug}`} className="text-xl font-medium">
        {t('title')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('lead')}</p>
      <ul className="flex flex-col gap-1 leading-8">
        {pattern.when ? <li>{t('when', { value: tTriggers(`times.${pattern.when}`) })}</li> : null}
        {pattern.where ? <li>{t('where', { value: tTriggers(`places.${pattern.where}`) })}</li> : null}
        {pattern.feeling ? <li>{t('feeling', { value: tTriggers(`feelings.${pattern.feeling}`) })}</li> : null}
      </ul>
      {limit ? <p className="font-medium">{t('suggestion', { limit })}</p> : null}
    </section>
  );
}

/**
 * «أنهِ هذا البرنامج»: ends this program only; its check-ins and notes are removed from this device at once. Without
 * an encrypted copy in the account nothing of it is kept. With one (or while that is not known yet), practice-core
 * `endProgram` keeps an end marker, which the vault needs so its older copy does not bring the program back; the
 * vault takes the end on its next save. Starting it again later is a fresh program.
 */
function EndProgram({ program }: { program: SinProgram }) {
  const t = useTranslations('leaveSin.program.end');
  const { userId, vault } = useSinVault();
  const keepMarker = userId !== null && vault.data !== null;
  function handleConfirm() {
    updateStore((store) => ({
      ...store,
      programs: keepMarker
        ? store.programs.map((p) => (p.sinSlug === program.sinSlug ? endProgram(p) : p))
        : store.programs.filter((p) => p.sinSlug !== program.sinSlug),
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
            {hasTriggers(c.triggers) ? <TriggerLine triggers={c.triggers} /> : null}
            {c.note ? <p className="break-words whitespace-pre-line">{c.note}</p> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function TriggerLine({ triggers }: { triggers: Triggers }) {
  const t = useTranslations('leaveSin.triggers');
  const parts = [
    triggers.when ? t(`times.${triggers.when}`) : null,
    triggers.where ? t(`places.${triggers.where}`) : null,
    triggers.feeling ? t(`feelings.${triggers.feeling}`) : null,
  ].filter((p): p is string => p !== null);
  return <span className="text-sm text-muted-foreground"> · {parts.join('، ')}</span>;
}

interface CheckInFormProps {
  program: SinProgram;
  today: string;
  /** After «وقعت ثم تبت» is saved: the page opens «خربانة؟ صلّحها». */
  onFell: () => void;
}

function CheckInForm({ program, today, onFell }: CheckInFormProps) {
  const t = useTranslations('leaveSin.checkIn');
  const tValues = useTranslations('leaveSin.program.values');
  const existing = program.checkIns.find((c) => c.date === today);
  const [triggers, setTriggers] = useState<Triggers | null>(null);
  const shownTriggers = triggers ?? existing?.triggers ?? {};
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

  const chosen = useWatch({ control: form.control, name: 'value' });

  function handleSubmit(values: Values) {
    const note = values.note.trim();
    const value = values.value as CheckInValue;
    updateStore((store) => ({
      ...store,
      programs: store.programs.map((p) => {
        if (p.sinSlug !== program.sinSlug) return p;
        const saved = checkIn(p, today, value, note || undefined);
        return value === 'held' ? saved : annotateCheckIn(saved, today, { triggers: shownTriggers });
      }),
    }));
    setTriggers(null);
    if (value === 'fell_repented' && existing?.value !== 'fell_repented') onFell();
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
        {chosen === 'weak' || chosen === 'fell_repented' ? <TriggerChips value={shownTriggers} onChange={setTriggers} /> : null}
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
