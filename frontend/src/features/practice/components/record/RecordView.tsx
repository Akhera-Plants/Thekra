'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  addDays,
  commitmentRates,
  countsAsNotDone,
  dayLogState,
  DEFAULT_REVIEW_DAY,
  FARD_LABELS,
  FARD_PRAYERS,
  FARD_STATS_DAYS,
  fardEnabled,
  fardStats,
  habitCompletion,
  parseDate,
  qadaProgress,
  weekday,
  weekDays,
  weekStart,
  type DayLogState,
  type Plan,
} from '@thekra/practice-core';
import { Link, useRouter } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { monthOf, type YearMonth } from '@/lib/practice/hub';
import { limitOptions } from '@/lib/practice/limits';
import { updatePrefs } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit, PracticeOccasion } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { useHeart } from '../../hooks/useHeart';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { DayDetailsDialog, DayDetailsPanel, useDayLogWord } from '../day/DayDetails';
import { HabitPrograms } from '../HabitPrograms';
import { HijriOffsetDialog } from '../HijriOffsetSelect';
import { StreakLine } from '../hub/HabitStats';
import { HubMonth } from '../hub/HubMonth';
import { CoveredGate } from '../lighten/CoveredGate';
import { PracticeLoading } from '../PracticeLoading';
import { usePlanWords } from '../plan-words';
import { QadaRing } from '../wird/QadaSection';

type RecordTab = 'week' | 'month' | 'tally';
const TABS: readonly RecordTab[] = ['week', 'month', 'tally'];

/**
 * «عاداتي › سجلّي» (round 6 §4, C-02d / C-03d; reference layout with our visuals): three tabs.
 * - «أسبوع»: a table of the habits over the week from the review day (future days disabled); a day opens its details.
 * - «شهر»: our calendar with the Hijri month and the occasions; the picked day's details beside it on a wide screen.
 * - «حصيلة»: the streak, each habit's commitment and completion, «الفرائض» and «قضاء الفوائت», and «تخفَّف» (covered).
 * A day's details hold the two answers and the note; a slipped day offers its review or shows it, with «تعلّم من
 * الخطأ». The «تخفَّف» part only once the programs are open. `?tab=` opens a tab.
 */
export function RecordView() {
  const context = useWirdContext();
  const params = useSearchParams();
  const router = useRouter();
  // An old «أضف» link (`/practice/habits?add=1` in round 5) may still land here: «أضف» opens on «اليوم».
  const add = params.get('add') === '1';
  const habit = params.get('habit');
  useEffect(() => {
    if (add) router.replace({ pathname: '/practice', query: habit ? { add: '1', habit } : { add: '1' } });
  }, [add, habit, router]);
  if (!context || add) return <PracticeLoading />;
  const requested = params.get('tab') as RecordTab | null;
  return <RecordBody context={context} initial={requested && TABS.includes(requested) ? requested : 'week'} />;
}

function isWeekly(occasion: PracticeOccasion): boolean {
  return occasion.rule.kind === 'weekdays';
}

function RecordBody({ context, initial }: { context: WirdContext; initial: RecordTab }) {
  const t = useTranslations('practice.recordTab');
  const heart = useHeart();
  const [tab, setTab] = useState<RecordTab>(initial);
  const [openDay, setOpenDay] = useState<string | null>(null);
  return (
    <>
      <SegmentTabs
        aria-label={t('tabsLabel')}
        value={tab}
        onValueChange={(v) => setTab(v as RecordTab)}
        variant="segment"
        size="hugged"
        listClassName="mb-8"
        items={TABS.map((key) => ({ value: key, label: t(`tabs.${key}`) }))}
      >
        <SegmentTabsContent value="week" className="outline-none">
          <WeekTable context={context} reviewDay={heart?.prefs.reviewDay ?? DEFAULT_REVIEW_DAY} onOpenDay={setOpenDay} />
        </SegmentTabsContent>
        <SegmentTabsContent value="month" className="outline-none">
          <MonthTab context={context} />
        </SegmentTabsContent>
        <SegmentTabsContent value="tally" className="outline-none">
          <TallyTab context={context} />
        </SegmentTabsContent>
      </SegmentTabs>
      <DayDetailsDialog context={context} heart={heart} date={openDay} onClose={() => setOpenDay(null)} />
    </>
  );
}

// ── أسبوع ────────────────────────────────────────────────────────────────────────────────────────────────────

function WeekTable({ context, reviewDay, onOpenDay }: { context: WirdContext; reviewDay: number; onOpenDay: (date: string) => void }) {
  const t = useTranslations('practice.recordTab');
  const tDays = useTranslations('practice.weekdaysShort');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const word = useDayLogWord();
  const { snapshot, today, habits, planDays } = context;
  const { store } = snapshot;
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => weekDays(addDays(weekStart(today, reviewDay), offset * 7), reviewDay), [today, reviewDay, offset]);
  const rows = useMemo(() => {
    const { isPeriodicAct } = limitOptions(habits);
    return store.plans
      .filter((p) => !isPeriodicAct?.(p) && p.createdOn <= days[6])
      .map((plan) => ({ plan, states: days.map((d) => dayLogState(store, plan, d, today, planDays)) }))
      .filter((r) => r.states.some((s) => s !== 'archived' && s !== 'beforeStart' && s !== 'future'));
  }, [store, habits, days, today, planDays]);

  return (
    <section aria-labelledby="record-week" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="record-week" className="text-2xl font-medium">
            {t('weekTitle')}
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">{t('weekLead')}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={t('prevWeek')} onClick={() => setOffset((o) => o - 1)} className={NAV_BUTTON}>
            <ChevronLeft aria-hidden className="size-5 rtl:-scale-x-100" />
          </button>
          <span className="px-1 text-sm tabular-nums">
            {formatGregorian(days[0], locale)} – {formatGregorian(days[6], locale)}
          </span>
          {offset >= 0 ? (
            // The current week has no next one: a spacer, not a dead button.
            <span aria-hidden className="size-11" />
          ) : (
            <button type="button" aria-label={t('nextWeek')} onClick={() => setOffset((o) => Math.min(0, o + 1))} className={NAV_BUTTON}>
              <ChevronRight aria-hidden className="size-5 rtl:-scale-x-100" />
            </button>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm leading-7 text-muted-foreground">{t('weekEmpty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[22rem] border-collapse text-sm">
            <caption className="sr-only">{t('weekTitle')}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="w-[30%] px-3 py-3 text-start font-normal text-muted-foreground">
                  {t('habit')}
                </th>
                {days.map((d) => (
                  <th key={d} scope="col" className="px-0.5 py-2 font-normal">
                    {d > today ? (
                      <span className="flex flex-col items-center leading-5 text-muted-foreground">
                        <span className="text-xs">{tDays(`d${weekday(d)}`)}</span>
                        <span className="tabular-nums">{formatDigits(parseDate(d).day)}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenDay(d)}
                        aria-label={t('openDay', { date: formatGregorian(d, locale, true) })}
                        className={cn(
                          'mx-auto flex min-h-11 min-w-9 flex-col items-center justify-center rounded-lg leading-5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                          d === today && 'bg-secondary font-semibold text-primary-text',
                        )}
                      >
                        <span className="text-xs">{tDays(`d${weekday(d)}`)}</span>
                        <span className="tabular-nums">{formatDigits(parseDate(d).day)}</span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ plan, states }) => (
                <WeekRow key={plan.id} plan={plan} states={states} days={days} habits={habits} word={word} today={today} onOpenDay={onOpenDay} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={t('legend')}>
        {(['done', 'partial', 'notDone', 'excused', 'notAsked'] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <Cell state={s} />
            {word(s)}
          </li>
        ))}
      </ul>
    </section>
  );
}

const NAV_BUTTON =
  'flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-30';

function WeekRow({
  plan,
  states,
  days,
  habits,
  word,
  today,
  onOpenDay,
}: {
  plan: Plan;
  states: DayLogState[];
  days: string[];
  habits: ReadonlyMap<string, PracticeHabit>;
  word: (s: DayLogState) => string;
  today: string;
  onOpenDay: (date: string) => void;
}) {
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const words = usePlanWords(plan, habitOf(plan, habits));
  return (
    <tr className="border-b border-border last:border-b-0">
      <th scope="row" className="px-3 py-2 text-start font-medium">
        <Link href={`/practice/habits/${plan.id}`} className="line-clamp-2 break-words hover:underline" lang={words.titleLang}>
          {words.title}
        </Link>
      </th>
      {states.map((state, i) => {
        const d = days[i] as string;
        const label = `${formatGregorian(d, locale, true)}: ${word(state)}`;
        return (
          <td key={d} className="px-0.5 py-2 text-center">
            {d > today ? (
              <span className="sr-only">{label}</span>
            ) : (
              <button
                type="button"
                aria-label={label}
                onClick={() => onOpenDay(d)}
                className="mx-auto flex h-11 w-full min-w-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Cell state={state} />
              </button>
            )}
          </td>
        );
      })}
    </tr>
  );
}

/** One cell's mark: kept (filled ✓), part kept (half), «لم تتم» (a calm hollow square), excused (a dash), not asked (dot). */
function Cell({ state }: { state: DayLogState }) {
  if (state === 'done')
    return (
      <span aria-hidden className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (state === 'partial') return <span aria-hidden className="block size-6 rounded-md border border-primary bg-[linear-gradient(to_top,var(--primary)_50%,transparent_50%)]" />;
  if (countsAsNotDone(state)) return <span aria-hidden className="block size-6 rounded-md border border-muted-foreground/40" />;
  if (state === 'excused') return <span aria-hidden className="block h-0.5 w-4 rounded-full bg-muted-foreground/50" />;
  if (state === 'open') return <span aria-hidden className="block size-6 rounded-md border border-dashed border-primary/60" />;
  if (state === 'archived' || state === 'beforeStart') return <span aria-hidden className="block size-6" />;
  return <span aria-hidden className="block size-1.5 rounded-full bg-muted-foreground/40" />;
}

// ── شهر ──────────────────────────────────────────────────────────────────────────────────────────────────────

function MonthTab({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.recordTab');
  const tRecord = useTranslations('practice.record');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const heart = useHeart();
  const { snapshot, today, occasions, planDays } = context;
  const { store, prefs } = snapshot;
  const showHijri = prefs.showHijri === true;
  const [picked, setPicked] = useState<string>(today);
  const [month, setMonth] = useState<YearMonth>(() => monthOf(today));
  const weekly = useMemo(() => (occasions ?? []).filter(isWeekly), [occasions]);
  const monthOccasions = useMemo(() => occasions?.filter((o) => !isWeekly(o)), [occasions]);
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
      <section aria-label={t('monthTitle')} className="flex min-w-0 flex-col gap-4">
        <HubMonth
          store={store}
          today={today}
          selected={picked}
          month={month}
          occasions={monthOccasions}
          planDays={planDays}
          showHijri={showHijri}
          onSelect={(date) => setPicked(date)}
          onMonthChange={setMonth}
          action={<HijriOffsetDialog />}
          weekStart={heart?.prefs.reviewDay ?? DEFAULT_REVIEW_DAY}
        />
        <label className="flex min-h-11 items-center gap-3 self-start text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={showHijri} onChange={(event) => updatePrefs((p) => ({ ...p, showHijri: event.target.checked }))} />
          {tRecord('showHijri')}
        </label>
        {weekly.length > 0 ? (
          <p className="flex items-start gap-2 text-sm leading-7">
            <Repeat aria-hidden className="mt-1.5 size-4 shrink-0 text-intent-good-deed" />
            <span>
              <span className="text-muted-foreground">{t('weekly')} </span>
              {weekly.map((o, i) => (
                <span key={o.key}>
                  {i > 0 ? (locale === 'ar' ? '، ' : ', ') : null}
                  <Link href={`/good-deeds/${o.deed}`} className="text-link">
                    {locale === 'en' ? o.titleEn : o.titleAr}
                  </Link>
                </span>
              ))}
            </span>
          </p>
        ) : null}
      </section>
      <aside aria-label={t('dayDetails')} className="flex min-w-0 flex-col gap-3 lg:border-s lg:border-border lg:ps-10">
        {picked > today ? <p className="text-sm leading-7 text-muted-foreground">{t('futureDay')}</p> : <DayDetailsPanel context={context} heart={heart} date={picked} />}
      </aside>
    </div>
  );
}

// ── حصيلة ────────────────────────────────────────────────────────────────────────────────────────────────────

function TallyTab({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.recordTab');
  const { snapshot, today, habits, catalog } = context;
  const { store } = snapshot;
  const rates = useMemo(() => commitmentRates(store, today, limitOptions(habits)), [store, today, habits]);
  const qada = qadaProgress(store, today);
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
      <div className="flex min-w-0 flex-col gap-8">
        {store.plans.length > 0 ? <StreakLine context={context} /> : null}
        <section aria-labelledby="record-commitment" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="record-commitment" className="text-xl font-medium">
              {t('commitmentTitle')}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">{t('commitmentLead')}</p>
          </div>
          {rates.length === 0 ? (
            <p className="text-sm leading-7 text-muted-foreground">{t('commitmentEmpty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border border-b border-border">
              {rates.map((rate) => {
                const plan = store.plans.find((p) => p.id === rate.planId);
                return plan ? <CommitmentRow key={plan.id} plan={plan} percent={rate.percent} habit={habitOf(plan, habits)} today={today} /> : null;
              })}
            </ul>
          )}
        </section>
      </div>
      <div className="flex min-w-0 flex-col gap-8 lg:border-s lg:border-border lg:ps-10">
        {fardEnabled(store) ? <FardStats context={context} /> : null}
        {qada ? (
          <section aria-labelledby="record-qada" className="flex flex-col gap-3">
            <h2 id="record-qada" className="text-xl font-medium">
              {t('qadaTitle')}
            </h2>
            <div className="flex items-center gap-4">
              <QadaRing percent={qada.percent} label={t('qadaRing', { done: formatDigits(qada.doneTotal), total: formatDigits(qada.owedTotal) })} />
              <p className="text-sm leading-7">{t('qadaLine', { done: formatDigits(qada.doneTotal), total: formatDigits(qada.owedTotal) })}</p>
            </div>
          </section>
        ) : null}
        {fardEnabled(store) || qada ? <SectionDivider /> : null}
        <CoveredGate store={store} as="block">
          {() => <HabitPrograms store={store} today={today} catalog={catalog.data} />}
        </CoveredGate>
      </div>
    </div>
  );
}

function CommitmentRow({ plan, percent, habit, today }: { plan: Plan; percent: number; habit: PracticeHabit | undefined; today: string }) {
  const t = useTranslations('practice.recordTab');
  const words = usePlanWords(plan, habit);
  const completion = habitCompletion(plan, today);
  return (
    <li>
      <Link
        href={`/practice/habits/${plan.id}`}
        className="group flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-base font-medium break-words" lang={words.titleLang}>
            {words.title}
          </span>
          <span aria-hidden className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ inlineSize: `${percent}%` }} />
          </span>
          <span className="text-xs text-muted-foreground">{t('completionLine', { n: formatDigits(completion.percent) })}</span>
        </span>
        <span className="shrink-0 text-base tabular-nums">{formatDigits(percent)}%</span>
        <DirectionalArrow className="size-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  );
}

/** «الفرائض» in «سجلّي»: counts over the last 30 days only (no streak, no «missed» wording). */
function FardStats({ context }: { context: WirdContext }) {
  const t = useTranslations('practice.recordTab');
  const lang = useLocale() === 'en' ? 'en' : 'ar';
  const stats = fardStats(context.snapshot.store, context.today);
  const labels = FARD_LABELS[lang];
  return (
    <section aria-labelledby="record-fard" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="record-fard" className="text-xl font-medium">
          {labels.title}
        </h2>
        <p className="text-sm leading-7 text-muted-foreground">
          {t('fardLead', { days: formatDigits(FARD_STATS_DAYS), onTime: formatDigits(stats.onTime), qada: formatDigits(stats.qada) })}
        </p>
      </div>
      <ul className="grid grid-cols-5 gap-2 text-center">
        {FARD_PRAYERS.map((prayer) => (
          <li key={prayer} className="flex flex-col gap-0.5 rounded-xl bg-muted/60 px-1 py-2.5">
            <span className="text-sm">{labels.prayers[prayer]}</span>
            <span className="text-lg font-medium tabular-nums">{formatDigits(stats.perPrayer[prayer].onTime)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('fardCountNote')}</p>
    </section>
  );
}
