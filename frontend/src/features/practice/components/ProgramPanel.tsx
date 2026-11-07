'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Waves } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  activeSinLoops,
  afterFall,
  annotateCheckIn,
  checkIn,
  CHECK_IN_VALUES,
  endProgram,
  hasTriggers,
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
import { InfoTip } from '@/components/shared/InfoTip';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { Button } from '@/components/shared/kit/button';
import { TitleRow } from '@/components/shared/kit/title-row';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { setMomentSource, updateStore } from '@/lib/practice/local-store';
import { programTextIds, programView } from '@/lib/practice/programs';
import type { QuoteDto } from '@/lib/types/api';
import type { PracticeHabit, SinProgramCommon, SinProgramEntry } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { z } from '@/lib/zod';
import { useLimitLabel } from '../hooks/useLimitLabel';
import { usePracticeStore } from '../hooks/usePracticeStore';
import { useSinVault } from '../hooks/useSinVault';
import { EvidenceQuotes } from './EvidenceQuotes';
import { FixItSheet } from './FixItSheet';
import { SinLoops } from './LoopBuilder';
import { RowMenu } from './RowMenu';
import { StoryLine } from './hub/KnowledgeCards';
import { TriggerChips } from './TriggerChips';

const MAX_NOTE = 500;
/** The texts shown in «رحلتي» before «كل ما ورد فيها» (the sin's page holds them all). */
const TEXTS_SHOWN = 3;

type ProgramTab = 'today' | 'journey';

interface ProgramPanelProps {
  program: SinProgram;
  entry: SinProgramEntry;
  common: SinProgramCommon;
  name: string | undefined;
  habits: ReadonlyMap<string, PracticeHabit>;
  /** Every program's evidence, fetched once for all (the request never names this program). */
  quotes: readonly QuoteDto[];
  today: string;
  /** Opens the dialog that switches programs and starts another (the name is its button). */
  onSwitch: () => void;
  /** After «أنهِ هذا البرنامج» was confirmed and done. */
  onEnded: () => void;
}

/**
 * One running program (owner round 5, F-11 a / A-21 a), the same screen as the app (mobile/app/practice/sin-program.tsx):
 * the program's name is a selectable title (it switches programs), «⋯» beside it holds «أنهِ هذا البرنامج» behind a
 * confirmation, then ONE tab bar:
 * - «اليوم»: the day's limit, ONE counter line, «لحظة مجاهدة», the evening check-in with its optional note (that note
 *   is the notebook), and after a slip the gentle after-fall content and «صلّحها»;
 * - «رحلتي»: the gradual steps, the stages with this week's task («حلقة المعصية» is the first week's task, filled
 *   once), «متى تضعف؟», the texts («آيات وأحاديث تعينك على ترك هذه المعصية», O-05), practical steps, good habits in its
 *   place, help, and the notebook's past days (folded).
 * Works with the common program too (no steps, alternatives or texts of its own: those parts are hidden). Reminders are
 * set in «التنبيهات» only, never here.
 */
export function ProgramPanel({ program, entry, common, name, habits, quotes, today, onSwitch, onEnded }: ProgramPanelProps) {
  const t = useTranslations('leaveSin.program');
  const tMoment = useTranslations('leaveSin.moment');
  const tLimits = useTranslations('leaveSin.limits');
  const tCounters = useTranslations('leaveSin.counters');
  const tStages = useTranslations('leaveSin.stages');
  const tFix = useTranslations('leaveSin.fixit');
  const tLoops = useTranslations('practice.loops');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const english = locale === 'en';
  const { userId, vault } = useSinVault();
  const view = programView(program, today);
  const stage = common.stages[view.stage];
  const steps = english ? entry.gradualStepsEn : entry.gradualStepsAr;
  const actions = english ? entry.actionsEn : entry.actionsAr;
  const fell = view.today?.value === 'fell_repented' && afterFall(program) === 'fixit';
  const limitLabel = useLimitLabel(actions);
  const [fixOpen, setFixOpen] = useState(false);
  const [tab, setTab] = useState<ProgramTab>('today');
  const counters = programCounters(program, today);
  const todayLimit = limitForToday(program, today);
  const todayLimitText = todayLimit ? limitLabel(todayLimit) : null;
  const track = stageTrack(program, today);
  const afterFallIds = common.afterFall.evidence ?? [];
  const hopeId = fell ? hopeTextFor(afterFallIds, quotes, today, shortestTextId(afterFallIds, quotes)) : null;
  const firstWeek = view.stageIndex === 0;
  const loopsFilled = activeSinLoops(program).length > 0;
  const textIds = programTextIds(entry, common, view.stage);
  const shownName = name ?? t('unnamed');
  const pathLong = program.path === 'gradual' ? t('pathGradual') : program.category === 'haqq_ibad' ? t('pathPeople') : t('pathCut');

  /**
   * Ends this program only; its check-ins and notes leave this device at once. With an encrypted copy in the account (or
   * while that is not known yet) practice-core `endProgram` keeps an end marker, so the vault's older copy does not bring
   * it back; the vault takes the end on its next save.
   */
  function handleEnd() {
    const keepMarker = userId !== null && vault.data !== null;
    updateStore((store) => ({
      ...store,
      programs: keepMarker
        ? store.programs.map((p) => (p.sinSlug === program.sinSlug ? endProgram(p) : p))
        : store.programs.filter((p) => p.sinSlug !== program.sinSlug),
    }));
    toast.success(t('end.toast'));
    onEnded();
  }

  return (
    <article className="flex flex-col gap-6" aria-label={shownName}>
      {/* The name is page content only (never a heading of the page title): a tap switches programs (A-21 a). */}
      <TitleRow
        action={
          <RowMenu
            label={t('menu')}
            remove={{
              label: t('end.button'),
              confirmTitle: t('end.confirmTitle'),
              note: t('end.confirmBody'),
              confirm: t('end.confirm'),
              keep: t('end.cancel'),
              onConfirm: handleEnd,
            }}
          />
        }
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onSwitch}
            aria-haspopup="dialog"
            aria-label={t('switchLabel', { name: shownName })}
            className="flex min-h-11 max-w-full items-center gap-2 self-start rounded-lg text-start text-2xl font-medium transition-colors hover:text-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="min-w-0">{shownName}</span>
            <ChevronDown className="size-5 shrink-0 text-primary-text" aria-hidden />
          </button>
          <p className="flex flex-wrap items-center gap-x-1 text-sm leading-7 text-muted-foreground">
            <span>
              {program.path === 'gradual' ? t('pathGradualShort') : t('pathCutShort')} ·{' '}
              {program.category === 'haqq_ibad' ? t('categoryIbad') : t('categoryAllah')}
            </span>
            <InfoTip>{pathLong}</InfoTip>
          </p>
        </div>
      </TitleRow>

      <SegmentTabs
        aria-label={t('tabsLabel')}
        items={[
          { value: 'today', label: t('tabs.today') },
          { value: 'journey', label: t('tabs.journey') },
        ]}
        value={tab}
        onValueChange={(value) => setTab(value === 'journey' ? 'journey' : 'today')}
        className="gap-6"
      >
        <SegmentTabsContent value="today" className="flex flex-col gap-6">
          {todayLimitText ? <p className="next-step !mt-0">{tLimits('today', { limit: todayLimitText })}</p> : null}

          {/* ONE counter line (A-21 a): held days of the window, and the days since the start or the last repentance. */}
          <p className="flex flex-wrap items-center gap-x-1 text-lg leading-8 font-medium">
            <span>
              {tCounters('held', { n: formatDigits(counters.held), total: formatDigits(counters.window) })} ·{' '}
              {tCounters(counters.fromStart ? 'sinceStart' : 'sinceRepentance', {
                count: counters.daysSinceRepentance,
                n: formatDigits(counters.daysSinceRepentance),
              })}
            </span>
            <InfoTip>{tCounters('note')}</InfoTip>
          </p>

          {/* Outlined: the check-in's «احفظ» is the area's one solid (A-08). */}
          <Button asChild variant="outline" tone="primary" size="lg" className="self-start">
            <Link href="/practice/leave-sin/moment" onClick={() => setMomentSource(program.sinSlug)}>
              <Waves aria-hidden />
              {tMoment('open')}
            </Link>
          </Button>

          {/* After a slip: the story of the man who killed a hundred, by id only (hidden until the id is filled). */}
          {fell ? <StoryLine moment="afterFall" /> : null}

          <CheckInForm program={program} today={today} onFell={() => setFixOpen(true)} />

          {fell ? (
            <section className="flex flex-col gap-3" aria-labelledby={`fall-${program.sinSlug}`}>
              <h3 id={`fall-${program.sinSlug}`} className="text-xl font-medium text-primary-text">
                {english ? common.afterFall.titleEn : common.afterFall.titleAr}
              </h3>
              <p className="max-w-3xl text-lg leading-9">{english ? common.afterFall.bodyEn : common.afterFall.bodyAr}</p>
              {hopeId ? (
                <div aria-label={tCounters('hope')} role="group">
                  <EvidenceQuotes ids={[hopeId]} quotes={quotes} />
                </div>
              ) : null}
              <Button tone="primary" size="md" className="self-start" onClick={() => setFixOpen(true)}>
                {tFix('open')}
              </Button>
            </section>
          ) : null}
        </SegmentTabsContent>

        <SegmentTabsContent value="journey" className="flex flex-col gap-6">
          {program.path === 'gradual' && steps && steps.length > 0 ? (
            <div className="next-step !mt-0 flex flex-col gap-1">
              <strong>{t('gradualTitle')}</strong>
              <ol className="list-decimal ps-5 leading-8">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}

          <section aria-labelledby={`stage-${program.sinSlug}`} className="flex flex-col gap-3">
            <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label={tStages('track')}>
              {track.map(({ stage: key, state }, index) => (
                <li key={key} aria-current={state === 'current' ? 'step' : undefined} className="flex min-w-0 shrink-0 items-center gap-1">
                  {index > 0 ? <span className={cn('h-px w-4', state === 'next' ? 'bg-border' : 'bg-primary')} aria-hidden /> : null}
                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap',
                      state === 'current' && 'border-primary bg-primary text-primary-foreground',
                      state === 'done' && 'border-primary text-primary-text',
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
            <p className="eyebrow">
              {t('stageOf', { n: formatDigits(view.stageIndex + 1), total: formatDigits(view.stageCount) })} ·{' '}
              {formatGregorian(view.stageSince, locale)}
            </p>
            <h3 id={`stage-${program.sinSlug}`} className="text-xl font-medium">
              {english ? stage.titleEn : stage.titleAr}
            </h3>
            <p className="max-w-3xl text-lg leading-9">{english ? stage.bodyEn : stage.bodyAr}</p>
            {/* This week's task; in the first week it is «حلقة المعصية», filled once (F-11 a). */}
            <div className="next-step !mt-0 flex flex-col gap-2">
              <strong>{tStages('taskTitle')}</strong>
              {firstWeek ? (
                <>
                  {loopsFilled ? (
                    <p className="flex items-center gap-2 !mt-0">
                      <Check className="size-4 shrink-0 text-primary-text" aria-hidden />
                      {t('loopTask.done')}
                    </p>
                  ) : (
                    <p className="!mt-0">{t('loopTask.title')}</p>
                  )}
                  <SinLoops program={program} single hideLead />
                </>
              ) : (
                <span>{tStages(`tasks.${STAGE_TASKS[view.stage]}`)}</span>
              )}
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{t('stageRule', { days: formatDigits(common.stageMinDays) })}</p>
          </section>

          {/* After the first week the loop stays at hand, folded (filled once, edited there). */}
          {!firstWeek ? (
            <Fold title={tLoops('sin.title')}>
              <SinLoops program={program} single />
            </Fold>
          ) : null}

          <WeakPatternCard program={program} actions={actions} />

          {textIds.length > 0 ? (
            <>
              <SectionDivider />
              <section className="flex flex-col gap-3" aria-label={t('textsTitle')}>
                {/* «المزيد» on the heading's row (A-03/F-04 a): the sin's own page holds all its texts. */}
                <EvidenceQuotes
                  ids={textIds.slice(0, TEXTS_SHOWN)}
                  quotes={quotes}
                  heading={t('textsTitle')}
                  subject={name}
                  action={
                    <Button asChild variant="outline" tone="primary" size="sm">
                      <Link href={`/sins/${program.sinSlug}`}>
                        {t('textsAll')} <DirectionalArrow />
                      </Link>
                    </Button>
                  }
                />
              </section>
            </>
          ) : null}

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

          {entry.alternatives.length > 0 ? <Alternatives keys={entry.alternatives} habits={habits} /> : null}

          {entry.help ? (
            <div className="next-step !mt-0">
              <strong>{t('help')}</strong>
              <p>{english ? common.helpEn : common.helpAr}</p>
            </div>
          ) : null}

          <SectionDivider />
          {/* The notebook: the evening check-ins and their notes, newest first, folded. */}
          <Fold title={t('notesTitle')} count={program.checkIns.filter((c) => c.date <= today).length}>
            <Notebook program={program} today={today} />
          </Fold>
        </SegmentTabsContent>
      </SegmentTabs>

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
    </article>
  );
}

/** A folded part of «رحلتي» (the notebook, the loop in later weeks): title, count, chevron. */
function Fold({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-xl font-medium">{title}</span>
        {count !== undefined ? <span className="text-sm text-muted-foreground tabular-nums">{formatDigits(count)}</span> : null}
        <ChevronDown aria-hidden className="size-5 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="flex flex-col gap-3 pt-2">{children}</div>
    </details>
  );
}

/** Good habits in its place: each opens «أضف عادة» with it chosen, or shows that it is already a habit. */
function Alternatives({ keys, habits }: { keys: readonly string[]; habits: ReadonlyMap<string, PracticeHabit> }) {
  const t = useTranslations('leaveSin.program');
  const tTopic = useTranslations('topic');
  const english = useLocale() === 'en';
  const snapshot = usePracticeStore();
  const planKeys = new Set((snapshot?.store.plans ?? []).map((p) => p.habitKey ?? p.id));
  const rows = keys.flatMap((key) => {
    const habit = habits.get(key);
    return habit ? [habit] : [];
  });
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="alternatives-title">
      <h3 id="alternatives-title" className="text-xl font-medium">
        {t('alternativesTitle')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('alternativesLead')}</p>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((habit) => {
          const title = english ? habit.titleEn : habit.titleAr;
          return (
            <li key={habit.key} className="flex min-h-16 items-center gap-3 py-2">
              <span className="min-w-0 flex-1 leading-8">{title}</span>
              {planKeys.has(habit.key) ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Check className="size-4 text-primary-text" aria-hidden />
                  {tTopic('habitAdded')}
                </span>
              ) : (
                <Button asChild variant="outline" tone="primary" size="sm">
                  <Link href={{ pathname: '/practice', query: { add: '1', habit: habit.key } }} aria-label={`${t('addAlternative')}: ${title}`}>
                    <Plus aria-hidden />
                    {t('addAlternative')}
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * «متى تضعف؟»: derived on this device from the trigger chips, never sent; the summary after 14 tagged check-ins, and
 * before that one line on how it fills.
 */
function WeakPatternCard({ program, actions }: { program: SinProgram; actions: readonly string[] }) {
  const t = useTranslations('leaveSin.pattern');
  const tTriggers = useTranslations('leaveSin.triggers');
  const limitLabel = useLimitLabel(actions);
  const pattern = weakPattern(program);
  const limit = pattern ? limitLabel(suggestedLimit(pattern, actions.length)) : null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5" aria-labelledby={`pattern-${program.sinSlug}`}>
      <h3 id={`pattern-${program.sinSlug}`} className="text-xl font-medium">
        {t('title')}
      </h3>
      {pattern ? (
        <>
          <p className="text-sm text-muted-foreground">{t('lead')}</p>
          <ul className="flex flex-col gap-1 leading-8">
            {pattern.when ? <li>{t('when', { value: tTriggers(`times.${pattern.when}`) })}</li> : null}
            {pattern.where ? <li>{t('where', { value: tTriggers(`places.${pattern.where}`) })}</li> : null}
            {pattern.feeling ? <li>{t('feeling', { value: tTriggers(`feelings.${pattern.feeling}`) })}</li> : null}
          </ul>
          {limit ? <p className="font-medium">{t('suggestion', { limit })}</p> : null}
        </>
      ) : (
        <p className="text-sm leading-7 text-muted-foreground">{t('waiting')}</p>
      )}
    </section>
  );
}

/** «دفتري الخاص»: past check-ins with their notes, newest first (inside its fold). The name of the sin is not in it. */
function Notebook({ program, today }: { program: SinProgram; today: string }) {
  const t = useTranslations('leaveSin.program');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const entries = program.checkIns.filter((c) => c.date <= today).slice().reverse();
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t('notebookEmpty')}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {entries.map((c) => (
        <li key={c.date} className="flex flex-col gap-1 py-3">
          <p className="text-sm text-muted-foreground">
            {formatGregorian(c.date, locale)} · {t(`values.${c.value}`)}
            {hasTriggers(c.triggers) ? <TriggerLine triggers={c.triggers} /> : null}
          </p>
          {c.note ? <p className="leading-8 break-words whitespace-pre-line">{c.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function TriggerLine({ triggers }: { triggers: Triggers }) {
  const t = useTranslations('leaveSin.triggers');
  const parts = [
    triggers.when ? t(`times.${triggers.when}`) : null,
    triggers.where ? t(`places.${triggers.where}`) : null,
    triggers.feeling ? t(`feelings.${triggers.feeling}`) : null,
  ].filter((p): p is string => p !== null);
  return <span> · {parts.join('، ')}</span>;
}

interface CheckInFormProps {
  program: SinProgram;
  today: string;
  /** After «زلّت قدمي ثم تبت» is saved: the page opens «صلّحها». */
  onFell: () => void;
}

/** «كيف كان يومك؟»: one of three, optional trigger chips after «ضعفت» / «زلّت قدمي», an optional private note. */
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
    toast.success(t('saved'));
    if (value === 'fell_repented' && existing?.value !== 'fell_repented') onFell();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5" noValidate>
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-2 text-xl font-medium">{t('title')}</legend>
                {CHECK_IN_VALUES.map((value) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3">
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
          <Button type="submit" tone="primary" size="md">
            {t('save')}
          </Button>
          {existing ? (
            <span className="text-sm text-muted-foreground">
              {t('saved')}
            </span>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
