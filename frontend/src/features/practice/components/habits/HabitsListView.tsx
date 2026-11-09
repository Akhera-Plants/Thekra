'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Archive, ArchiveRestore, Ellipsis, Lightbulb, Plus, Sprout, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ARCHIVE_MAX,
  archivedPlans,
  archiveNote,
  habitAddChoice,
  habitCompletion,
  habitListRows,
  habitMilestones,
  LIMITS,
  programCounters,
  shareSuggestion,
  type Plan,
  type SinProgram,
} from '@thekra/practice-core';
import { Link, useRouter } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { Button } from '@/components/shared/kit/button';
import { TitleRow } from '@/components/shared/kit/title-row';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { limitOptions } from '@/lib/practice/limits';
import { habitOf } from '@/lib/practice/plans';
import { planWeekdays } from '@/lib/practice/days';
import type { PracticeHabit } from '@/lib/types/practice';
import { useInCircle } from '../../hooks/useInCircle';
import { useSinNames } from '../../hooks/useSinNames';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { GraduationOffers } from '../hub/HabitStats';
import { CoveredGate } from '../lighten/CoveredGate';
import { PracticeLoading } from '../PracticeLoading';
import { usePlanWords } from '../plan-words';
import { AddHabitFlow } from '../wird/AddHabitFlow';
import { ArchiveDialog, DeleteDialog, HabitLimitSheet, restoreHabit } from './HabitActions';

/** The strategies shown as a teaser in «استراتيجيات صناعة العادات والثبات» (build · keep · return). */
const STRATEGY_TEASER = ['start-tiny', 'if-then', 'prepare-place'] as const;

/**
 * «عاداتي › العادات» (round 6 §2, C-02b / C-01d / C-02e; reference «الخطة» layout with our visuals): the member's habits
 * with their completion percentage and milestone lines («تعدّيت أصعب فترة»، «صنعت العادة»، and «شارك تطورك مع الرفقة»
 * for a fresh milestone when the member is in a «رفقة» circle, as in the app: GET /circles/access), the line «3 عادات كحد
 * أقصى», ONE «أضف عادة» on the title row, the «تخفَّف» programs as COVERED habit rows, then «الأرشيف» (at most 10, the
 * 3-day note, «أعِدها» / delete). A side column (after the list on a phone) holds «استراتيجيات صناعة العادات والثبات».
 * `?add=1` opens «أضف عادة» here and comes back here.
 */
export function HabitsListView() {
  const context = useWirdContext();
  const router = useRouter();
  const params = useSearchParams();
  if (!context) return <PracticeLoading />;
  if (params.get('add') === '1') {
    return <AddHabitFlow context={context} habitKey={params.get('habit')} onClose={() => router.replace('/practice/habits')} />;
  }
  return <HabitsBody context={context} />;
}

function HabitsBody({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.myHabits');
  const router = useRouter();
  const { snapshot, today, habits } = context;
  const { store } = snapshot;
  const opts = limitOptions(habits);
  const rows = useMemo(() => habitListRows(store, null, opts).filter((r) => r.kind === 'habit'), [store, opts]);
  const archived = archivedPlans(store);
  const [archiving, setArchiving] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [restoreAfter, setRestoreAfter] = useState<string | null>(null);
  const full = habitAddChoice(store, today, opts) !== null;

  function add() {
    if (full) setLimitOpen(true);
    else router.push({ pathname: '/practice/habits', query: { add: '1' } });
  }

  function restore(plan: Plan) {
    const ok = restoreHabit(plan.id, today, habits, { kept: t('restoredKept'), reset: t('restoredReset') });
    if (!ok) {
      setRestoreAfter(plan.id);
      setLimitOpen(true);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="my-habits-title" className="flex flex-col gap-3">
          <TitleRow
            action={
              <Button icon={<Plus aria-hidden />} onClick={add}>
                {t('add')}
              </Button>
            }
          >
            <h2 id="my-habits-title" className="text-2xl font-medium">
              {t('title')}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">
              {t('limitLine', { max: formatDigits(LIMITS.sapling) })}
              {' · '}
              {t('count', { n: formatDigits(rows.length) })}
            </p>
          </TitleRow>
          <GraduationOffers context={context} />
          {rows.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border p-4">
              <p className="text-muted-foreground">{t('empty')}</p>
            </div>
          ) : null}
          <ul className="flex flex-col divide-y divide-border border-b border-border">
            {rows.map((row) =>
              row.kind === 'habit' ? (
                <HabitRowItem key={row.plan.id} plan={row.plan} context={context} onArchive={() => setArchiving(row.plan)} onDelete={() => setDeleting(row.plan)} />
              ) : null,
            )}
            <CoveredGate store={store}>{(programs) => programs.map((p) => <ProgramRowItem key={p.sinSlug} program={p} today={today} />)}</CoveredGate>
          </ul>
        </section>

        <SectionDivider />

        <section aria-labelledby="archive-title" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="archive-title" className="text-xl font-medium">
              {t('archiveTitle')}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">
              {t('archiveLead', { max: formatDigits(ARCHIVE_MAX), n: formatDigits(archived.length) })}
            </p>
          </div>
          {archived.length === 0 ? (
            <p className="text-sm leading-7 text-muted-foreground">{t('archiveEmpty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {archived.map((plan) => (
                <ArchivedRow key={plan.id} plan={plan} context={context} onRestore={() => restore(plan)} onDelete={() => setDeleting(plan)} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside aria-labelledby="strategies-side" className="flex min-w-0 flex-col gap-4 lg:border-s lg:border-border lg:ps-10">
        <StrategiesTeaser />
      </aside>

      <ArchiveDialog plan={archiving} store={store} today={today} habits={habits} onOpenChange={(o) => (o ? undefined : setArchiving(null))} />
      <DeleteDialog plan={deleting} habits={habits} onOpenChange={(o) => (o ? undefined : setDeleting(null))} />
      <HabitLimitSheet
        open={limitOpen}
        onOpenChange={(o) => {
          setLimitOpen(o);
          if (!o) setRestoreAfter(null);
        }}
        store={store}
        today={today}
        habits={habits}
        onFreed={() => {
          setLimitOpen(false);
          if (restoreAfter) {
            const id = restoreAfter;
            setRestoreAfter(null);
            // The place is free now: the restore goes through.
            window.setTimeout(() => restoreHabit(id, today, habits, { kept: t('restoredKept'), reset: t('restoredReset') }), 0);
          } else router.push({ pathname: '/practice/habits', query: { add: '1' } });
        }}
      />
    </div>
  );
}

function useDaysLine(plan: Plan, habit: PracticeHabit | undefined): string | null {
  const t = useTranslations('practice.habitPage');
  const tDays = useTranslations('practice.weekdaysShort');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const days = planWeekdays(plan, habit?.defaultRule);
  if (days === null) return null;
  if (days.length === 7) return t('everyDay');
  return days.map((d) => tDays(`d${d}`)).join(locale === 'ar' ? '، ' : ', ');
}

function HabitRowItem({ plan, context, onArchive, onDelete }: { plan: Plan; context: WirdContext; onArchive: () => void; onDelete: () => void }) {
  const t = useTranslations('practice.myHabits');
  const { today, habits } = context;
  const habit = habitOf(plan, habits);
  const words = usePlanWords(plan, habit);
  const daysLine = useDaysLine(plan, habit);
  const completion = habitCompletion(plan, today);
  const milestones = habitMilestones(plan, today);
  // «رفقة» is in the app: the line is the same suggestion as there, without a web page to open.
  const share = useInCircle() && shareSuggestion(plan, today) !== null;
  return (
    <li className="flex items-center gap-2 py-1">
      <Link
        href={`/practice/habits/${plan.id}`}
        className="group flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary-text">
          <Sprout className="size-[1.125rem]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lg leading-7 font-medium break-words" lang={words.titleLang}>
            {words.title}
          </span>
          <span className="text-sm leading-6 text-muted-foreground">{[words.amount(plan.amount), daysLine].filter(Boolean).join(' · ')}</span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ inlineSize: `${completion.percent}%` }} />
            </span>
            <span className="shrink-0 text-sm tabular-nums">{t('percent', { n: formatDigits(completion.percent) })}</span>
          </span>
          {milestones.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {milestones.map((m) => (
                <span key={m.key} className="rounded-full bg-secondary px-2.5 py-0.5 text-sm text-primary-text">
                  {t(`milestones.${m.key}`)}
                </span>
              ))}
              {share ? <span className="px-1 py-0.5 text-sm font-medium text-primary-text">{t('share')}</span> : null}
            </span>
          ) : null}
        </span>
        <DirectionalArrow className="size-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
      </Link>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" tone="neutral" size="sm" iconOnly icon={<Ellipsis aria-hidden />} aria-label={t('options', { title: words.title })} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-52 p-1.5">
          <DropdownMenuItem className="min-h-11 px-2" onSelect={onArchive}>
            <Archive aria-hidden />
            {t('archive')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="min-h-11 px-2" onSelect={onDelete}>
            <Trash2 aria-hidden />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** A «تخفَّف» program as a habit row (only rendered once the programs are open). */
function ProgramRowItem({ program, today }: { program: SinProgram; today: string }) {
  const t = useTranslations('practice.myHabits');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const sins = useSinNames(locale);
  const sin = sins.data?.find((s) => s.slug === program.sinSlug);
  const name = sin ? (locale === 'en' ? sin.name || sin.nameAr : sin.nameAr) : t('lightenType');
  const counters = programCounters(program, today);
  return (
    <li className="py-1">
      <Link
        href="/practice/leave-sin"
        className="group flex min-h-16 items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Sprout className="size-[1.125rem]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-lg leading-7 font-medium break-words">{name}</span>
          <span className="text-sm leading-6 text-muted-foreground">
            {t('lightenType')} · {t('lightenDays', { n: formatDigits(counters.daysSinceRepentance) })}
          </span>
        </span>
        <DirectionalArrow className="size-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  );
}

function ArchivedRow({ plan, context, onRestore, onDelete }: { plan: Plan; context: WirdContext; onRestore: () => void; onDelete: () => void }) {
  const t = useTranslations('practice.myHabits');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { today, habits } = context;
  const words = usePlanWords(plan, habitOf(plan, habits));
  const note = archiveNote(plan, today);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/practice/habits/${plan.id}`} className="text-base font-medium break-words hover:underline" lang={words.titleLang}>
          {words.title}
        </Link>
        <span className="text-sm leading-6 text-muted-foreground">
          {t('archivedSince', { date: formatGregorian(plan.pausedOn as string, locale) })} ·{' '}
          {note.resetsIfRestoredToday ? t('willReset') : t('keepsUntil', { date: formatGregorian(note.keepsProgressUntil, locale) })}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" tone="primary" size="sm" icon={<ArchiveRestore aria-hidden />} onClick={onRestore}>
          {t('restore')}
        </Button>
        <Button variant="ghost" tone="destructive" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label={t('deleteNamed', { title: words.title })} onClick={onDelete} />
      </div>
    </li>
  );
}

/** «استراتيجيات صناعة العادات والثبات» (C-02b: instead of «ما يساند خطتك»): three short ideas and the library. */
function StrategiesTeaser() {
  const t = useTranslations('practice.myHabits');
  const tItems = useTranslations('practice.strategies.items');
  return (
    <section className="flex flex-col gap-4">
      <h2 id="strategies-side" className="flex items-center gap-2 text-lg font-medium">
        <Lightbulb aria-hidden className="size-5 text-primary-text" />
        {t('strategiesTitle')}
      </h2>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {STRATEGY_TEASER.map((key) => (
          <li key={key} className="py-3 text-sm leading-7">
            {tItems(`${key}.idea`)}
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" tone="primary" className="self-start">
        <Link href="/practice/strategies">
          {t('strategiesAll')} <DirectionalArrow />
        </Link>
      </Button>
    </section>
  );
}
