'use client';

import { useMemo, useState } from 'react';
import { Ellipsis, Pencil, PencilLine, Sprout, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { addDays, deletePlan, increase, isPaused, planAsksOn, removeHabitLoop, requiredOn, type Plan } from '@thekra/practice-core';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { TitleRow } from '@/components/shared/kit/title-row';
import { SectionDivider } from '@/components/shared/SectionDivider';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { planWeekdays } from '@/lib/practice/days';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf, planToday, MONTH_DAYS } from '@/lib/practice/plans';
import { currentPrayerLookup } from '@/lib/practice/screen-stores';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { useDeletesEverywhere } from '../../hooks/useDeletesEverywhere';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { CommitmentChart } from '../CommitmentChart';
import { FetchedEvidence } from '../EvidenceQuotes';
import { LogEditor } from '../LogEditor';
import { PracticeLoading } from '../PracticeLoading';
import { changePlan, usePlanWords } from '../plan-words';
import { HabitEditDialog } from './HabitEditDialog';

/**
 * «صفحة العادة» (round 5, F-31 a): a summary — the name, the last 30 days, «زد خطوة» when it is due, the evidence
 * («آيات وأحاديث تعينك على هذه الطاعة»), the member's own loop answers and the weekly commitment. Every setting is in ONE
 * «عدّل» dialog (times, days, a lower amount, pause); delete sits in «⋯» with a confirmation. No logging here except
 * «صحّح السجل» (today's circle is on «ورد اليوم»).
 */
export function HabitPage({ id }: { id: string }) {
  const context = useWirdContext();
  const t = useTranslations('practice.habitPage');
  if (!context) return <PracticeLoading />;
  const plan = context.snapshot.store.plans.find((p) => p.id === id);
  if (!plan) {
    return (
      <div className="flex max-w-3xl flex-col items-start gap-3">
        <h1 id="page-title" tabIndex={-1} className="text-3xl font-medium">
          {t('missingTitle')}
        </h1>
        <p className="text-muted-foreground">{t('missingLead')}</p>
        <Button asChild variant="outline" tone="primary">
          <Link href="/practice">{t('back')}</Link>
        </Button>
      </div>
    );
  }
  return <HabitSummary key={plan.id} plan={plan} habit={habitOf(plan, context.habits)} context={context} />;
}

function HabitSummary({ plan, habit, context }: { plan: Plan; habit: PracticeHabit | undefined; context: WirdContext }) {
  const t = useTranslations('practice.habitPage');
  const tToday = useTranslations('practice.today');
  const tDays = useTranslations('practice.weekdaysShort');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const router = useRouter();
  const words = usePlanWords(plan, habit);
  const { today, snapshot } = context;
  const [editing, setEditing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const everywhere = useDeletesEverywhere();
  const paused = isPaused(plan);
  const view = useMemo(
    () =>
      planToday(plan, today, 0, {
        fallback: habit?.defaultRule,
        hijriOffset: snapshot.store.settings.hijriOffset,
        prayer: currentPrayerLookup()(today),
      }),
    [plan, today, habit, snapshot.store.settings.hijriOffset],
  );
  const days = planWeekdays(plan, habit?.defaultRule);
  const daysLine =
    days === null
      ? null
      : days.length === 7
        ? t('everyDay')
        : `${t('daysCount', { count: days.length, n: formatDigits(days.length) })} · ${days.map((d) => tDays(`d${d}`)).join(locale === 'ar' ? '، ' : ', ')}`;
  const status = [
    paused ? tToday('pausedSince', { date: formatGregorian(plan.pausedOn as string, locale) }) : null,
    t('amount', { amount: words.amount(plan.amount) }),
    daysLine,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="page-heading !mb-0 !max-w-none">
        <TitleRow
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" tone="primary" size="sm" icon={<Pencil aria-hidden />} onClick={() => setEditing(true)}>
                {t('edit')}
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" tone="neutral" size="sm" iconOnly icon={<Ellipsis aria-hidden />} aria-label={t('more', { title: words.title })} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-56 p-1.5">
                  <DropdownMenuItem className="min-h-11 px-2" onSelect={() => setFixing(true)}>
                    <PencilLine aria-hidden />
                    {tToday('editLog.open')}
                  </DropdownMenuItem>
                  {habit ? (
                    <DropdownMenuItem asChild className="min-h-11 px-2">
                      <Link href={`/good-deeds/${habit.deed}`}>
                        <Sprout aria-hidden />
                        {tToday('readAbout')}
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" className="min-h-11 px-2" onSelect={() => setRemoving(true)}>
                    <Trash2 aria-hidden />
                    {tToday('remove')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        >
          <h1 id="page-title" tabIndex={-1} lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
            {words.title}
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">{status}</p>
        </TitleRow>
      </header>

      <LastDays plan={plan} today={today} context={context} />

      {!paused && view.canIncrease && view.increaseTo !== null ? (
        <div className="next-step !mt-0 flex flex-col items-start gap-2">
          <p>{tToday('increaseOffer', { amount: words.amount(view.increaseTo) })}</p>
          <Button
            variant="outline"
            tone="primary"
            size="sm"
            className="h-auto whitespace-normal py-2 text-start"
            onClick={() => {
              changePlan(plan.id, (p) => increase(p, today));
              toast.success(t('increased', { amount: words.amount(view.increaseTo as number) }));
            }}
          >
            {t('increase')}
          </Button>
        </div>
      ) : null}

      <SectionDivider />
      <section aria-label={t('commitment')} className="flex flex-col gap-3">
        <CommitmentChart plan={plan} today={today} label={t('commitment')} />
      </section>

      {plan.loops && plan.loops.length > 0 ? (
        <>
          <SectionDivider />
          <section aria-labelledby="habit-loops" className="flex flex-col gap-3">
            <h2 id="habit-loops" className="text-xl font-medium">
              {t('loopsTitle')}
            </h2>
            <ul className="flex flex-col divide-y divide-border border-b border-border">
              {plan.loops.map((loop) => (
                <li key={loop.id} className="flex items-start justify-between gap-3 py-3">
                  <dl className="flex flex-col gap-1 text-sm leading-7">
                    {loop.cue ? (
                      <div>
                        <dt className="inline text-muted-foreground">{t('loopCue')} </dt>
                        <dd className="inline">{loop.cue}</dd>
                      </div>
                    ) : null}
                    {loop.ifThen ? (
                      <div>
                        <dt className="inline text-muted-foreground">{t('loopIfThen')} </dt>
                        <dd className="inline">{loop.ifThen}</dd>
                      </div>
                    ) : null}
                    {!loop.cue && !loop.ifThen ? <dd>{loop.routine}</dd> : null}
                  </dl>
                  <Button
                    variant="ghost"
                    tone="neutral"
                    size="sm"
                    iconOnly
                    icon={<Trash2 aria-hidden />}
                    aria-label={t('loopRemove')}
                    onClick={() => {
                      changePlan(plan.id, (p) => removeHabitLoop(p, loop.id));
                      toast.success(t('loopRemoved'));
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {habit && habit.evidence.length > 0 ? (
        <>
          <SectionDivider />
          <section aria-label={t('evidence')}>
            <FetchedEvidence ids={habit.evidence} heading={t('evidence')} subject={words.title} />
          </section>
        </>
      ) : null}

      <HabitEditDialog
        plan={plan}
        habit={habit}
        today={today}
        title={words.title}
        amountLabel={words.amount}
        open={editing}
        onOpenChange={setEditing}
      />
      <Dialog open={fixing} onOpenChange={setFixing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{tToday('editLog.open')}</DialogTitle>
            <DialogDescription className="leading-7">{words.title}</DialogDescription>
          </DialogHeader>
          {fixing ? (
            <LogEditor
              plan={plan}
              today={today}
              unit={words.unit}
              onDone={() => {
                setFixing(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeTitle', { title: words.title })}</AlertDialogTitle>
            <AlertDialogDescription>{everywhere ? tToday('removeNoteAccount') : tToday('removeNoteDevice')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" tone="neutral" onClick={() => setRemoving(false)}>
              {tToday('keep')}
            </Button>
            <Button
              tone="destructive"
              onClick={() => {
                setRemoving(false);
                updateStore((s) => deletePlan(s, plan.id));
                toast.success(t('removed', { title: words.title }));
                router.replace('/practice');
              }}
            >
              {tToday('removeConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The last 30 days as small marks (the plan's own schedule, the same answer «ورد اليوم» uses) (oldest first, in reading order): done, some, not done, not asked. No streak words. */
function LastDays({ plan, today, context }: { plan: Plan; today: string; context: WirdContext }) {
  const t = useTranslations('practice.habitPage');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const days = useMemo(() => {
    const out: { date: string; level: 'full' | 'some' | 'none' | 'off' | 'before' }[] = [];
    for (let i = MONTH_DAYS - 1; i >= 0; i--) {
      const date = addDays(today, -i);
      const done = plan.log[date] ?? 0;
      const level =
        date < plan.createdOn
          ? 'before'
          : done > 0
            ? done >= requiredOn(plan, date)
              ? 'full'
              : 'some'
            : planAsksOn(plan, date, context.planDays)
              ? 'none'
              : 'off';
      out.push({ date, level });
    }
    return out;
  }, [plan, today, context.planDays]);
  const doneDays = days.filter((d) => d.level === 'full' || d.level === 'some').length;
  return (
    <section aria-labelledby="habit-days" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="habit-days" className="text-xl font-medium">
          {t('lastDays', { n: formatDigits(MONTH_DAYS) })}
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">
          {t('doneDays', { count: doneDays, n: formatDigits(doneDays), total: formatDigits(MONTH_DAYS) })}
        </p>
      </div>
      <ol className="grid grid-cols-10 gap-1.5 sm:max-w-md" aria-label={t('lastDays', { n: formatDigits(MONTH_DAYS) })}>
        {days.map((day) => (
          <li
            key={day.date}
            title={formatGregorian(day.date, locale, true)}
            aria-label={`${formatGregorian(day.date, locale, true)}: ${t(`level.${day.level}`)}`}
            className={cn(
              'aspect-square rounded-md border',
              day.level === 'full' && 'border-primary bg-primary',
              day.level === 'some' && 'border-primary bg-[linear-gradient(to_top,var(--primary)_50%,transparent_50%)]',
              day.level === 'none' && 'border-border bg-transparent',
              day.level === 'off' && 'border-transparent bg-muted',
              day.level === 'before' && 'border-dashed border-border bg-transparent opacity-50',
              day.date === today && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
            )}
          />
        ))}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(['full', 'some', 'none', 'off'] as const).map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                'size-3 rounded-sm border',
                level === 'full' && 'border-primary bg-primary',
                level === 'some' && 'border-primary bg-[linear-gradient(to_top,var(--primary)_50%,transparent_50%)]',
                level === 'none' && 'border-border',
                level === 'off' && 'border-transparent bg-muted',
              )}
            />
            {t(`level.${level}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
