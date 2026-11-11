'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  addDays,
  countsAsNotDone,
  dayLogState,
  eveningOf,
  intentionOf,
  intentionState,
  reviewHistory,
  setHeartPrefs,
  weeklyOf,
  weeklyReviewDue,
  type Plan,
  type WeeklyReview,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { SegmentTabs, SegmentTabsContent } from '@/components/shared/kit/segment-tabs';
import { Switch } from '@/components/shared/kit/switch';
import { TitleRow } from '@/components/shared/kit/title-row';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateHeart } from '@/lib/practice/heart-store';
import { limitOptions } from '@/lib/practice/limits';
import { notificationPrefsOf, updatePrefs } from '@/lib/practice/local-store';
import { habitOf } from '@/lib/practice/plans';
import { resendPushPrefs } from '@/lib/push/web-push';
import { useHeart } from '../../hooks/useHeart';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { LearnFromSlip } from '../day/DayDetails';
import { EveningCard, IntentionCard, planTitle, WeeklyCard, type HeartContext } from '../hub/HeartCards';
import { PracticeLoading } from '../PracticeLoading';
import { usePlanWords } from '../plan-words';

/** Earlier reviews shown before «المزيد» (A-12 a: short lists). */
const ARCHIVE_SHOWN = 4;
/** Habits shown in «تعلّم من الخطأ» at most. */
const LEARN_SHOWN = 2;

type ReviewTab = 'day' | 'week';
type Open = 'intention' | 'evening' | 'weekly' | 'day' | null;

/**
 * «عاداتي › محاسبتي» (round 6 §4, C-02c; reference layout with our visuals): two tabs «اليوم / الأسبوع». «اليوم» holds
 * «نية اليوم» and «محاسبة المساء»; «الأسبوع» holds the weekly review (its day is the member's choice) and «خطوتك
 * القادمة». Both end with «تعلّم من الخطأ» for the habits that slipped. A side column (after the tabs on a phone) keeps
 * «وقفات سابقة», so earlier reviews are always there to learn from. Kind but firm words; no «حاسب نفسك الآن», no
 * «رسائلي إلى نفسي» here (they moved to the top of «عاداتي»). `?tab=week` opens the week.
 */
export function ReviewView() {
  const context = useWirdContext();
  const heart = useHeart();
  if (!context || !heart) return <PracticeLoading />;
  const ctx: HeartContext = {
    store: context.snapshot.store,
    heart,
    today: context.today,
    time: context.time,
    habits: context.habits,
    planDays: context.planDays,
  };
  return <ReviewBody ctx={ctx} context={context} />;
}

function ReviewBody({ ctx, context }: { ctx: HeartContext; context: WirdContext }) {
  const t = useTranslations('practice.review');
  const tIntention = useTranslations('practice.heart.intention');
  const tDays = useTranslations('practice.weekdays');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const params = useSearchParams();
  const { heart, today, time } = ctx;
  const [tab, setTab] = useState<ReviewTab>(params.get('tab') === 'week' ? 'week' : 'day');
  const [open, setOpen] = useState<Open>(null);
  const intention = intentionOf(heart, today);
  const state = intentionState(heart, today, time);
  const evening = eveningOf(heart, today);
  const weekDue = weeklyReviewDue(heart, today, time);
  const weekOf = weekDue ?? today;
  const weekSaved = weeklyOf(heart, today) !== undefined;
  const reviews = reviewHistory(heart);
  const latest = reviews[0];

  function saved(message: string) {
    setOpen(null);
    toast.success(message);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-medium">{t('heading')}</h2>
          <p className="text-base leading-8 text-muted-foreground">{t('headingLead')}</p>
        </div>
        <SegmentTabs
          aria-label={t('tabsLabel')}
          value={tab}
          onValueChange={(v) => setTab(v as ReviewTab)}
          variant="segment"
          size="hugged"
          listClassName="mb-6"
          items={[
            { value: 'day', label: t('tabs.day') },
            { value: 'week', label: t('tabs.week') },
          ]}
        >
          <SegmentTabsContent value="day" className="flex flex-col gap-8 outline-none">
            <Section
              id="review-intention"
              title={tIntention('title')}
              action={
                <Switch
                  aria-label={t('intentionSwitch')}
                  checked={heart.prefs.intention}
                  onCheckedChange={(on) => {
                    updateHeart((h) => setHeartPrefs(h, { intention: on }));
                    toast.success(on ? t('intentionOn') : t('intentionOff'));
                  }}
                />
              }
            >
              <p className="text-sm leading-7 text-muted-foreground">
                {intention ? tIntention('made') : heart.prefs.intention ? t('intentionUntil') : t('intentionHint')}
              </p>
              {heart.prefs.intention && !intention && state === 'card' ? (
                <Button size="sm" className="self-start" onClick={() => setOpen('intention')}>
                  {t('intentionWrite')}
                </Button>
              ) : null}
            </Section>
            <SectionDivider />
            <Section
              id="review-evening"
              title={t('eveningTitle')}
              action={
                evening ? null : (
                  <Button variant="outline" tone="primary" size="sm" onClick={() => setOpen('evening')}>
                    {t('startEvening')}
                  </Button>
                )
              }
            >
              <p className="text-sm leading-7 text-muted-foreground">{evening ? t('eveningDone') : t('eveningHint')}</p>
            </Section>
            <LearnSection context={context} from={addDays(today, -1)} to={today} />
          </SegmentTabsContent>

          <SegmentTabsContent value="week" className="flex flex-col gap-8 outline-none">
            <Section id="review-weekly" title={t('weeklyTitle')}>
              <blockquote className="border-s-2 border-primary ps-4 text-lg leading-9">
                <p>{t('weeklyStrong1')}</p>
                <p className="text-muted-foreground">{t('weeklyStrong2')}</p>
              </blockquote>
              <p className="text-sm leading-7 text-muted-foreground">
                {weekSaved
                  ? t('weeklyDone')
                  : heart.prefs.fridayReview
                    ? t('weeklyDay', { day: tDays(`d${heart.prefs.reviewDay}`) })
                    : t('weeklyOff')}
              </p>
              <ActionPair className="sm:max-w-md">
                <Button onClick={() => setOpen('weekly')} disabled={weekSaved}>
                  {t('reviewWeek')}
                </Button>
                <Button variant="outline" tone="primary" icon={<CalendarDays aria-hidden />} onClick={() => setOpen('day')}>
                  {t('pickDay')}
                </Button>
              </ActionPair>
            </Section>
            <SectionDivider />
            <NextStep review={latest} context={context} />
            <LearnSection context={context} from={addDays(today, -6)} to={today} />
          </SegmentTabsContent>
        </SegmentTabs>
      </div>

      <aside aria-labelledby="review-archive" className="flex min-w-0 flex-col gap-3 lg:border-s lg:border-border lg:ps-10">
        <h2 id="review-archive" className="text-xl font-medium">
          {t('pastTitle')}
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm leading-7 text-muted-foreground">{t('archiveEmpty')}</p>
        ) : (
          <ShortList items={reviews} render={(review) => <ArchiveRow key={review.weekOf} review={review} context={context} />} />
        )}
      </aside>

      <Dialog open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">
              {open === 'intention' ? tIntention('title') : open === 'evening' ? t('eveningTitle') : open === 'weekly' ? t('weeklyTitle') : t('pickDay')}
            </DialogTitle>
            <DialogDescription className="sr-only">{t('dialogNote')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pe-1">
            {open === 'intention' ? <IntentionCard ctx={ctx} bare onSaved={() => saved(tIntention('made'))} /> : null}
            {open === 'evening' ? <EveningCard ctx={ctx} bare onSaved={() => saved(t('eveningSaved'))} /> : null}
            {open === 'weekly' ? <WeeklyCard ctx={ctx} bare weekOf={weekOf} onSaved={() => saved(t('weeklySaved'))} /> : null}
            {open === 'day' ? (
              <DayPicker
                value={heart.prefs.reviewDay}
                on={heart.prefs.fridayReview}
                onSave={(day, on) => {
                  updateHeart((h) => setHeartPrefs(h, { reviewDay: day, fridayReview: on }));
                  updatePrefs((p) => ({ ...p, notify: { ...notificationPrefsOf(p), reviewDay: day, fridayReview: on } }));
                  void resendPushPrefs(locale);
                  saved(on ? t('daySaved', { day: tDays(`d${day}`) }) : t('weeklyOff'));
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <TitleRow action={action}>
        <h3 id={id} className="text-xl font-medium">
          {title}
        </h3>
      </TitleRow>
      {children}
    </section>
  );
}

/** «خطوتك القادمة» (reference): the step chosen in the latest weekly review, on its habit; else how to choose one. */
function NextStep({ review, context }: { review: WeeklyReview | undefined; context: WirdContext }) {
  const t = useTranslations('practice.review');
  const plan = review?.step ? context.snapshot.store.plans.find((p) => p.id === review.step?.planId) : undefined;
  return (
    <section aria-labelledby="review-next" className="flex flex-col gap-2">
      <h3 id="review-next" className="text-xl font-medium">
        {t('nextTitle')}
      </h3>
      {plan && review?.step ? <StepLine plan={plan} choice={review.step.choice} context={context} /> : <p className="text-sm leading-7 text-muted-foreground">{t('nextNone')}</p>}
    </section>
  );
}

function StepLine({ plan, choice, context }: { plan: Plan; choice: 'increase' | 'lighten' | 'keep'; context: WirdContext }) {
  const t = useTranslations('practice.review');
  const words = usePlanWords(plan, habitOf(plan, context.habits));
  return (
    <p className="text-base leading-8">
      {t(`next.${choice}`, { title: words.title, amount: words.amount(plan.amount) })}{' '}
      <Link href={`/practice/habits/${plan.id}`} className="text-link text-sm">
        {t('openHabit')}
      </Link>
    </p>
  );
}

/** «تعلّم من الخطأ»: the habits with a «لم تتم» day in the window, the most slipped first (at most two). */
function LearnSection({ context, from, to }: { context: WirdContext; from: string; to: string }) {
  const t = useTranslations('practice.learn');
  const { snapshot, today, habits, planDays } = context;
  const { store } = snapshot;
  const slipped = useMemo(() => {
    const { isPeriodicAct } = limitOptions(habits);
    const scored = store.plans
      .filter((p) => !isPeriodicAct?.(p))
      .map((plan) => {
        let missed = 0;
        for (let d = from; d <= to; d = addDays(d, 1)) if (countsAsNotDone(dayLogState(store, plan, d, today, planDays))) missed++;
        return { plan, missed };
      })
      .filter((x) => x.missed > 0)
      .sort((a, b) => b.missed - a.missed);
    return scored.slice(0, LEARN_SHOWN).map((x) => x.plan);
  }, [store, habits, from, to, today, planDays]);
  if (slipped.length === 0) return null;
  return (
    <>
      <SectionDivider />
      <section aria-labelledby={`learn-${from}`} className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id={`learn-${from}`} className="text-xl font-medium">
            {t('sectionTitle')}
          </h3>
          <p className="text-sm leading-7 text-muted-foreground">{t('sectionLead')}</p>
        </div>
        {slipped.map((plan) => (
          <LearnFromSlip key={plan.id} plan={plan} store={store} today={today} context={context} />
        ))}
      </section>
    </>
  );
}

/** A short list (A-12 a): the first rows, then «المزيد» shows the rest. */
function ShortList<T>({ items, render }: { items: readonly T[]; render: (item: T) => ReactNode }) {
  const t = useTranslations('practice.review');
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, ARCHIVE_SHOWN);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-border border-y border-border">{shown.map(render)}</ul>
      {items.length > ARCHIVE_SHOWN ? (
        <Button variant="ghost" tone="primary" size="sm" className="self-start" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? t('less') : t('more', { n: formatDigits(items.length - ARCHIVE_SHOWN) })}
        </Button>
      ) : null}
    </div>
  );
}

/** One weekly review: the week, then the habits that were hard as short rows (the two weakest first), and its step. */
function ArchiveRow({ review, context }: { review: WeeklyReview; context: WirdContext }) {
  const t = useTranslations('practice.review');
  const tWeekly = useTranslations('practice.heart.weekly');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const titleOf = (planId: string, stored: string) => {
    const plan = context.snapshot.store.plans.find((p) => p.id === planId);
    return plan ? planTitle(plan, context.habits, locale === 'en') : stored;
  };
  const weak = review.weak.slice(0, 2);
  return (
    <li className="flex flex-col gap-2 py-3">
      <p className="text-base font-medium">{t('weekOf', { date: formatGregorian(review.weekOf, locale, false) })}</p>
      {weak.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {weak.map((r) => (
            <li key={r.planId} className="flex items-center justify-between gap-3 text-sm">
              <span>{titleOf(r.planId, r.title)}</span>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {tWeekly('missed', { count: r.missed, n: formatDigits(r.missed) })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{tWeekly('weakNone')}</p>
      )}
      {review.weak.length > 2 ? <p className="text-xs text-muted-foreground">{t('moreWeak', { n: formatDigits(review.weak.length - 2) })}</p> : null}
      {review.step ? (
        <p className="text-sm text-muted-foreground">
          {t('stepWas', { title: titleOf(review.step.planId, ''), step: tWeekly(review.step.choice) })}
        </p>
      ) : null}
    </li>
  );
}

/** «اختر اليوم»: the weekly review's day (any weekday), or off. */
function DayPicker({ value, on, onSave }: { value: number; on: boolean; onSave: (day: number, on: boolean) => void }) {
  const t = useTranslations('practice.review');
  const tDays = useTranslations('practice.weekdays');
  const [day, setDay] = useState<number | 'off'>(on ? value : 'off');
  const name = useId();
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col">
        <legend className="mb-2 text-sm text-muted-foreground">{t('pickDayHint')}</legend>
        {[6, 0, 1, 2, 3, 4, 5].map((d) => (
          <label key={d} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted">
            <input type="radio" name={name} className="size-4 accent-primary" checked={day === d} onChange={() => setDay(d)} />
            {tDays(`d${d}`)}
          </label>
        ))}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted">
          <input type="radio" name={name} className="size-4 accent-primary" checked={day === 'off'} onChange={() => setDay('off')} />
          {t('noWeekly')}
        </label>
      </fieldset>
      <Button className="self-start" onClick={() => onSave(day === 'off' ? value : day, day !== 'off')}>
        {t('save')}
      </Button>
    </div>
  );
}
