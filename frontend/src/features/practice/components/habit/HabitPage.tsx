'use client';

import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Archive, ArchiveRestore, Ellipsis, Minus, PencilLine, Plus, Sprout, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  addDays,
  canIncrease,
  correctLog,
  decreaseTo,
  habitCompletion,
  habitMilestones,
  increase,
  isArchived,
  logForDay,
  logMinimum,
  makeUpOffer,
  minimumOf,
  minimumToLog,
  missedDayBefore,
  nextStep,
  planAsksOn,
  reflectionOf,
  relapseSuggestionFor,
  requiredOnDay,
  setReflection,
  status as planStatus,
  type Plan,
} from '@thekra/practice-core';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { planWeekdays } from '@/lib/practice/days';
import { updateStore } from '@/lib/practice/local-store';
import { habitOf, MONTH_DAYS } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { useHeart } from '../../hooks/useHeart';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { CommitmentChart } from '../CommitmentChart';
import { HabitDayDialog, LearnFromSlip } from '../day/DayDetails';
import { FetchedEvidence } from '../EvidenceQuotes';
import { ArchiveDialog, DeleteDialog, restoreHabit, HabitLimitSheet } from '../habits/HabitActions';
import { HabitLoops } from '../LoopBuilder';
import { editableDays, LogEditor } from '../LogEditor';
import { PracticeLoading } from '../PracticeLoading';
import { changePlan, usePlanWords } from '../plan-words';
import { HabitsTabBar } from '../tabs/HabitsTabBar';
import { ChosenMakeUp, FixButton } from '../wird/FixDialog';
import { HabitSettingsForm } from './HabitSettingsForm';

const TABS = ['follow', 'loop', 'reminders', 'return'] as const;
type HabitTab = (typeof TABS)[number];

/**
 * «صفحة العادة» (round 6 §3, C-02e a / C-27 a / C-03c; reference layout with our visuals): the «عاداتي» tabs, a wide
 * header (the amount, the days and times, «القدر الأدنى», «تعديل العادة» — one dialog for all of them, round 7 C3 — and
 * «⋯»: correct the log, read about the deed, archive, delete), then the reference tabs «المتابعة · حلقة العادة ·
 * التذكيرات · العودة بعد انقطاع». Logging and the day note ARE here (the owner overrides F-31), with the two optional
 * questions; the last 30 days (a day opens what was recorded on it, C4) and the completion. On a wide
 * screen the texts that help sit in a second column («آيات وأحاديث تعينك على هذه الطاعة»).
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
          <Link href="/practice/habits">{t('back')}</Link>
        </Button>
      </div>
    );
  }
  return <HabitView key={plan.id} plan={plan} habit={habitOf(plan, context.habits)} context={context} />;
}

function HabitView({ plan, habit, context }: { plan: Plan; habit: PracticeHabit | undefined; context: WirdContext }) {
  const t = useTranslations('practice.habitPage');
  const tToday = useTranslations('practice.today');
  const tDays = useTranslations('practice.weekdaysShort');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const router = useRouter();
  const params = useSearchParams();
  const words = usePlanWords(plan, habit);
  const { today, snapshot, habits } = context;
  const requested = params.get('tab');
  const [tab, setTab] = useState<HabitTab>(TABS.includes(requested as HabitTab) ? (requested as HabitTab) : 'follow');
  const [fixing, setFixing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const archived = isArchived(plan);
  const days = planWeekdays(plan, habit?.defaultRule);
  const daysLine =
    days === null ? null : days.length === 7 ? t('everyDay') : days.map((d) => tDays(`d${d}`)).join(locale === 'ar' ? '، ' : ', ');
  const restoreMessages = { kept: t('restoredKept'), reset: t('restoredReset') };

  return (
    <div className="flex flex-col gap-8">
      <header className="page-heading !mb-0 flex !max-w-none flex-col gap-5">
        <h1 id="page-title" tabIndex={-1} lang={words.titleLang} dir={words.titleLang ? 'rtl' : undefined}>
          {words.title}
        </h1>
        <HabitsTabBar />
      </header>

      <section aria-label={t('summary')} className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/20 bg-secondary/60 px-4 py-4 sm:px-6">
        <span aria-hidden className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-background text-primary-text sm:flex">
          <Sprout className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-2xl font-medium">{words.amount(plan.amount)}</p>
          <p className="text-sm leading-7 text-muted-foreground">
            {archived
              ? t('archivedSince', { date: formatGregorian(plan.pausedOn as string, locale) })
              : [daysLine, t('minimumLine', { amount: words.amount(minimumOf(plan)) })].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archived ? (
            <Button
              variant="outline"
              tone="primary"
              size="sm"
              icon={<ArchiveRestore aria-hidden />}
              onClick={() => {
                if (!restoreHabit(plan.id, today, habits, restoreMessages)) setLimitOpen(true);
              }}
            >
              {t('restore')}
            </Button>
          ) : (
            <Button variant="outline" tone="primary" size="sm" icon={<PencilLine aria-hidden />} onClick={() => setEditing(true)}>
              {t('editHabit')}
            </Button>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" tone="neutral" size="sm" iconOnly icon={<Ellipsis aria-hidden />} aria-label={t('more', { title: words.title })} />
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
              {archived ? null : (
                <DropdownMenuItem className="min-h-11 px-2" onSelect={() => setArchiving(true)}>
                  <Archive aria-hidden />
                  {t('archive')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="min-h-11 px-2" onSelect={() => setRemoving(true)}>
                <Trash2 aria-hidden />
                {tToday('remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SegmentTabs
          aria-label={t('tabsLabel')}
          value={tab}
          onValueChange={(v) => setTab(v as HabitTab)}
          variant="underline"
          size="hugged"
          className="min-w-0"
          listClassName="mb-6 w-full gap-0 overflow-x-auto [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden [&>button]:px-2 sm:[&>button]:px-3"
          items={TABS.map((key) => ({ value: key, label: t(`tabs.${key}`) }))}
        >
          <SegmentTabsContent value="follow" className="outline-none">
            <FollowTab plan={plan} context={context} />
          </SegmentTabsContent>
          <SegmentTabsContent value="loop" className="outline-none">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-xl font-medium">{t('loopTitle')}</h2>
                  <p className="text-sm leading-7 text-muted-foreground">{t('loopLead')}</p>
                </div>
                <Link href="/practice/strategies" className="text-link text-sm">
                  {t('strategy')}
                </Link>
              </div>
              <HabitLoops plan={plan} compact />
            </div>
          </SegmentTabsContent>
          <SegmentTabsContent value="reminders" className="outline-none">
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-medium">{t('remindersTitle')}</h2>
              <HabitSettingsForm plan={plan} habit={habit} today={today} amountLabel={words.amount} />
              <Link href="/settings/notifications" className="text-link self-start text-sm">
                {t('allNotifications')}
              </Link>
            </div>
          </SegmentTabsContent>
          <SegmentTabsContent value="return" className="outline-none">
            <ReturnTab plan={plan} context={context} title={words.title} />
          </SegmentTabsContent>
        </SegmentTabs>

        <aside aria-label={t('evidence')} className="flex min-w-0 flex-col gap-4 lg:border-s lg:border-border lg:ps-10">
          {habit && habit.evidence.length > 0 ? (
            <FetchedEvidence ids={habit.evidence} heading={t('evidence')} subject={words.title} />
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">{t('noEvidence')}</p>
          )}
        </aside>
      </div>

      <Dialog open={fixing} onOpenChange={setFixing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{tToday('editLog.open')}</DialogTitle>
            <DialogDescription className="leading-7">{words.title}</DialogDescription>
          </DialogHeader>
          {fixing ? <LogEditor plan={plan} today={today} unit={words.unit} onDone={() => setFixing(false)} /> : null}
        </DialogContent>
      </Dialog>
      {/* «تعديل العادة» (round 7, C3): times, days, amount and «القدر الأدنى» in one dialog; the header shows them. */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">{t('editHabit')}</DialogTitle>
            <DialogDescription className="leading-7">{words.title}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <HabitSettingsForm plan={plan} habit={habit} today={today} amountLabel={words.amount} withMinimum onDone={() => setEditing(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
      <ArchiveDialog plan={archiving ? plan : null} store={snapshot.store} today={today} habits={habits} onOpenChange={setArchiving} onDone={() => router.replace('/practice/habits')} />
      <DeleteDialog plan={removing ? plan : null} habits={habits} onOpenChange={setRemoving} onDone={() => router.replace('/practice/habits')} />
      <HabitLimitSheet
        open={limitOpen}
        onOpenChange={setLimitOpen}
        store={snapshot.store}
        today={today}
        habits={habits}
        onFreed={() => {
          setLimitOpen(false);
          window.setTimeout(() => restoreHabit(plan.id, today, habits, restoreMessages), 0);
        }}
      />
    </div>
  );
}

/** «المتابعة»: log a day (today or a recent one), the day note and the two questions, «القدر الأدنى», then the progress. */
function FollowTab({ plan, context }: { plan: Plan; context: WirdContext }) {
  const t = useTranslations('practice.habitPage');
  const tToday = useTranslations('practice.today');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { today, snapshot, habits } = context;
  const words = usePlanWords(plan, habitOf(plan, habits));
  const dateId = useId();
  const days = editableDays(plan, today);
  const [date, setDate] = useState(today);
  const done = plan.log[date] ?? 0;
  const required = requiredOnDay(snapshot.store, plan, date);
  const step = plan.unit === 'minutes' ? 5 : 1;
  const completion = habitCompletion(plan, today);
  const milestones = habitMilestones(plan, today);
  const archived = isArchived(plan);
  const nextAmount = canIncrease(plan, today) ? nextStep(plan.amount) : null;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="habit-log" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="habit-log" className="text-xl font-medium">
              {t('logTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">{formatGregorian(date, locale, true)}</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={dateId} className="sr-only">
              {tToday('editLog.day')}
            </label>
            <Select value={date} onValueChange={setDate}>
              <SelectTrigger id={dateId} className="h-11 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d, i) => (
                  <SelectItem key={d} value={d}>
                    {i === 0 ? tToday('editLog.today') : i === 1 ? tToday('editLog.yesterday') : formatGregorian(d, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {archived ? (
          <p className="text-sm leading-7 text-muted-foreground">{t('archivedNoLog')}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                tone="neutral"
                iconOnly
                icon={<Minus aria-hidden />}
                aria-label={t('less')}
                disabled={done <= 0}
                onClick={() => changePlan(plan.id, (p) => correctLog(p, date, Math.max(0, (p.log[date] ?? 0) - step)))}
              />
              <p className="flex items-baseline gap-1.5" aria-live="polite">
                <span className="text-3xl font-medium tabular-nums">{formatDigits(done)}</span>
                <span className="text-sm text-muted-foreground">/ {words.amount(required)}</span>
              </p>
              <Button
                variant="outline"
                tone="primary"
                iconOnly
                icon={<Plus aria-hidden />}
                aria-label={t('more1')}
                onClick={() => changePlan(plan.id, (p) => logForDay(p, date, step, today))}
              />
            </div>
            {done < required ? (
              <Button
                variant="ghost"
                tone="primary"
                size="sm"
                onClick={() => {
                  changePlan(plan.id, (p) => logForDay(p, date, required - (p.log[date] ?? 0), today));
                  toast.success(tToday('logged'));
                }}
              >
                {tToday('markDone')}
              </Button>
            ) : (
              <span className="text-sm text-primary-text">{tToday('complete')}</span>
            )}
          </div>
        )}
        <ReflectionForm key={date} plan={plan} date={date} context={context} />
      </section>

      <SectionDivider />

      <section aria-labelledby="habit-progress" className="flex flex-col gap-3">
        <h2 id="habit-progress" className="text-xl font-medium">
          {t('progressTitle')}
        </h2>
        <p className="flex items-center gap-3">
          <span aria-hidden className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ inlineSize: `${completion.percent}%` }} />
          </span>
          <span className="shrink-0 text-base tabular-nums">{t('completion', { n: formatDigits(completion.percent) })}</span>
        </p>
        <p className="text-sm leading-7 text-muted-foreground">
          {completion.keptDays >= completion.targetDays
            ? t('keptDaysReady', { n: formatDigits(completion.doneDays) })
            : t('keptDays', { n: formatDigits(completion.doneDays), target: formatDigits(completion.targetDays) })}
        </p>
        {milestones.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {milestones.map((m) => (
              <li key={m.key} className="rounded-full bg-secondary px-3 py-1 text-sm text-primary-text">
                {t(`milestones.${m.key}`)} · {formatGregorian(m.on, locale)}
              </li>
            ))}
          </ul>
        ) : null}
        <LastDays plan={plan} today={today} context={context} />
        {!archived && nextAmount !== null && nextAmount > plan.amount ? <IncreaseOffer plan={plan} context={context} next={nextAmount} /> : null}
      </section>

      <SectionDivider />
      <section aria-label={t('commitment')} className="flex flex-col gap-3">
        <CommitmentChart plan={plan} today={today} label={t('commitment')} />
      </section>
    </div>
  );
}

function IncreaseOffer({ plan, context, next }: { plan: Plan; context: WirdContext; next: number }) {
  const t = useTranslations('practice.habitPage');
  const tToday = useTranslations('practice.today');
  const words = usePlanWords(plan, habitOf(plan, context.habits));
  const { today } = context;
  return (
    <div className="next-step !mt-0 flex flex-col items-start gap-2">
      <p>{tToday('increaseOffer', { amount: words.amount(next) })}</p>
      <Button
        variant="outline"
        tone="primary"
        size="sm"
        className="h-auto whitespace-normal py-2 text-start"
        onClick={() => {
          changePlan(plan.id, (p) => increase(p, today));
          toast.success(t('increased', { amount: words.amount(next) }));
        }}
      >
        {t('increase')}
      </Button>
    </div>
  );
}

/** The day note and the two optional questions (C-27): saved per habit and day, shown in «سجلّي». */
function ReflectionForm({ plan, date, context }: { plan: Plan; date: string; context: WirdContext }) {
  const t = useTranslations('practice.reflection');
  const { snapshot, today } = context;
  const saved = reflectionOf(snapshot.store, plan.id, date);
  const [helped, setHelped] = useState(saved?.helped ?? '');
  const [hard, setHard] = useState(saved?.hard ?? '');
  const [note, setNote] = useState(saved?.note ?? '');
  const ids = { helped: useId(), hard: useId(), note: useId() };
  const changed = helped !== (saved?.helped ?? '') || hard !== (saved?.hard ?? '') || note !== (saved?.note ?? '');
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        updateStore((s) => setReflection(s, { planId: plan.id, date, today, helped, hard, note }));
        toast.success(t('saved'));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={ids.helped} label={t('helped')} value={helped} onChange={setHelped} rows={2} />
        <Field id={ids.hard} label={t('hard')} value={hard} onChange={setHard} rows={2} />
      </div>
      <Field id={ids.note} label={t('note')} value={note} onChange={setNote} rows={3} />
      <p className="text-xs text-muted-foreground">{t('optional')}</p>
      <Button type="submit" variant="outline" tone="primary" className="self-start" disabled={!changed}>
        {t('save')}
      </Button>
    </form>
  );
}

function Field({ id, label, value, onChange, rows }: { id: string; label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Textarea id={id} rows={rows} maxLength={300} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** «العودة بعد انقطاع»: «صلّحها» when the gap condition holds, a smaller way back after a long gap, the member's own plan, and the path of the slip. */
function ReturnTab({ plan, context, title }: { plan: Plan; context: WirdContext; title: string }) {
  const t = useTranslations('practice.habitPage');
  const tToday = useTranslations('practice.today');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const heart = useHeart();
  const { today, snapshot, planDays, habits } = context;
  const words = usePlanWords(plan, habitOf(plan, habits));
  const missedYesterday = missedDayBefore(snapshot.store, plan, today, planDays);
  const offer = heart ? makeUpOffer(snapshot.store, plan, today, { ...planDays, heart }) : null;
  const relapse = planStatus(plan, today) === 'relapse';
  const back = relapseSuggestionFor(plan);
  const chosen = (heart?.makeUps ?? []).filter((m) => m.planId === plan.id).slice(-3).reverse();
  const loop = plan.loops?.find((l) => l.ifThen || l.obstacle);
  const gap = (missedYesterday || offer !== null) && !isArchived(plan);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-medium">{t('returnTitle')}</h2>
        <p className="text-sm leading-7 text-muted-foreground">{t('returnLead')}</p>
      </div>
      {gap ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4">
          <p className="text-base">{offer !== null ? t('gapTwice') : t('gapYesterday')}</p>
          <FixButton
            plan={plan}
            title={title}
            today={today}
            offer={offer}
            missedYesterday={missedYesterday}
            onMinimum={minimumToLog(plan, today) !== null ? () => changePlan(plan.id, (p) => logMinimum(p, today, today)) : undefined}
          />
        </div>
      ) : (
        <p className="text-base leading-8">{t('noGap')}</p>
      )}
      {relapse && back < plan.amount ? (
        <div className="next-step !mt-0 flex flex-col items-start gap-2">
          <p>{tToday('relapse', { amount: words.amount(back) })}</p>
          <Button
            variant="outline"
            tone="primary"
            size="sm"
            onClick={() => {
              changePlan(plan.id, (p) => decreaseTo(p, back, today));
              toast.success(t('lowered', { amount: words.amount(back) }));
            }}
          >
            {tToday('relapseAction', { amount: words.amount(back) })}
          </Button>
        </div>
      ) : null}
      <section className="flex flex-col gap-2" aria-labelledby="return-plan">
        <h3 id="return-plan" className="text-lg font-medium">
          {t('yourPlan')}
        </h3>
        {loop ? <p className="text-base leading-8">«{loop.ifThen || loop.obstacle}»</p> : <p className="text-sm leading-7 text-muted-foreground">{t('noPlan')}</p>}
      </section>
      {chosen.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="return-deeds">
          <h3 id="return-deeds" className="text-lg font-medium">
            {t('makeUps')}
          </h3>
          <ul className="flex flex-col gap-2">
            {chosen.map((m) => (
              <li key={`${m.on}-${m.date}`} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{formatGregorian(m.date, locale)}</span>
                <ChosenMakeUp deed={m} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <LearnFromSlip plan={plan} store={snapshot.store} today={today} context={context} />
    </div>
  );
}

/** The last 30 days as small marks (the plan's own schedule): done, some, not done (calm), not asked. */
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
            ? done >= requiredOnDay(context.snapshot.store, plan, date)
              ? 'full'
              : 'some'
            : planAsksOn(plan, date, context.planDays)
              ? 'none'
              : 'off';
      out.push({ date, level });
    }
    return out;
  }, [plan, today, context.planDays, context.snapshot.store]);
  const doneDays = days.filter((d) => d.level === 'full' || d.level === 'some').length;
  const [openDay, setOpenDay] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-medium">{t('lastDays', { n: formatDigits(MONTH_DAYS) })}</h3>
        <p className="text-sm leading-7 text-muted-foreground">
          {t('doneDays', { count: doneDays, n: formatDigits(doneDays), total: formatDigits(MONTH_DAYS) })}
        </p>
      </div>
      {/* Round 7 (C4): a day opens what was logged and written on it; a day with words carries a small dot. */}
      <ol className="grid grid-cols-10 gap-1.5 sm:max-w-md sm:grid-cols-15" aria-label={t('lastDays', { n: formatDigits(MONTH_DAYS) })}>
        {days.map((day) => {
          const written = reflectionOf(context.snapshot.store, plan.id, day.date) !== null;
          const label = `${formatGregorian(day.date, locale, true)}: ${t(`level.${day.level}`)}${written ? ` · ${t('written')}` : ''}`;
          return (
            <li key={day.date} className="aspect-square">
              <button
                type="button"
                title={formatGregorian(day.date, locale, true)}
                aria-label={label}
                disabled={day.level === 'before'}
                onClick={() => setOpenDay(day.date)}
                className={cn(
                  'relative size-full rounded-md border transition-transform duration-150 enabled:hover:scale-110 motion-reduce:transition-none',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  day.level === 'full' && 'border-primary bg-primary',
                  day.level === 'some' && 'border-primary bg-[linear-gradient(to_top,var(--primary)_50%,transparent_50%)]',
                  day.level === 'none' && 'border-border bg-transparent',
                  day.level === 'off' && 'border-transparent bg-muted',
                  day.level === 'before' && 'cursor-default border-dashed border-border bg-transparent opacity-50',
                  day.date === today && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
                )}
              >
                {written ? (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-0 bottom-0.5 mx-auto block size-1.5 rounded-full',
                      day.level === 'full' ? 'bg-primary-foreground' : 'bg-primary',
                    )}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
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
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          {t('written')}
        </li>
      </ul>
      <Link href="/practice/record" className="text-link self-start text-sm">
        {t('openRecord')}
      </Link>
      <HabitDayDialog context={context} plan={plan} date={openDay} onClose={() => setOpenDay(null)} />
    </div>
  );
}
