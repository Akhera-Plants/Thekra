'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  activePrograms,
  applyStep,
  dayAgenda,
  daySummary,
  eveningCardVisible,
  intentionOf,
  intentionState,
  keepPledge,
  makeIntention,
  markMessageSeen,
  muraqabaQuoteId,
  pledgeEvidence,
  pledgesDue,
  saveEvening,
  saveWeeklyReview,
  selfMessageDue,
  setHeartPrefs,
  stepChoices,
  updatePlan,
  weeklyReviewDue,
  weekSummary,
  type HeartData,
  type HeartFeeling,
  type PledgeKept,
  type Plan,
  type PlanDayOptions,
  type StepChoice,
  type Store,
} from '@thekra/practice-core';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/shared/kit/button';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateHeart } from '@/lib/practice/heart-store';
import { updateStore } from '@/lib/practice/local-store';
import { pledgeText, quotedTitle } from '@/lib/practice/pledges';
import { EvidenceButton } from '../Pledges';
import { habitOf } from '@/lib/practice/plans';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { TextSourceLine } from '@/components/shared/quote/TextSourceLine';
import { stripOuterQuotes } from '@/lib/texts/quote-text';
import { usePracticeEvidence } from '../../hooks/usePracticeEvidence';

export interface HeartContext {
  store: Store;
  heart: HeartData;
  today: string;
  /** `HH:MM` now, local. */
  time: string;
  habits: ReadonlyMap<string, PracticeHabit>;
  planDays: PlanDayOptions;
}

/** The plan's title in the page language (the catalog's, else the stored one). */
export function planTitle(plan: Plan, habits: ReadonlyMap<string, PracticeHabit>, english: boolean): string {
  const habit = habitOf(plan, habits);
  return habit ? (english ? habit.titleEn : habit.titleAr) : plan.title;
}

function Card({ title, children, labelledBy }: { title: ReactNode; children: ReactNode; labelledBy?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={labelledBy ?? id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <h2 id={labelledBy ?? id} className="text-lg font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Radio-like chips: one choice, a second tap keeps it. */
function Chips<T extends string>({ value, options, onChange, label }: { value: T | null; options: { key: T; text: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'min-h-11 rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
            value === o.key ? 'border-primary bg-secondary text-primary-text' : 'border-border hover:bg-muted',
          )}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

/** المراقبة: one published text a day under the header, read from the API; hidden without it. */
export function MuraqabaLine({ today }: { today: string }) {
  const t = useTranslations('practice.heart');
  const id = muraqabaQuoteId(today);
  const evidence = usePracticeEvidence(id ? [id] : []);
  const quote = evidence.data?.find((q) => q.id === id);
  if (!quote) return null;
  return (
    <figure aria-label={t('muraqabaLabel')} className="flex max-w-3xl flex-col gap-1">
      <p className="line-clamp-2 text-base leading-8 text-muted-foreground">
        <Link href={`/quotes/${quote.id}`} lang="ar" dir="rtl" className="font-quran hover:text-foreground">
          {stripOuterQuotes(quote.textAr)}
        </Link>
      </p>
      {/* Its source, always visible under the cut text (W-06). */}
      <figcaption>
        <TextSourceLine quote={quote} />
      </figcaption>
    </figure>
  );
}

/** المعاتبة: last week's «رسالة إلى نفسي», first on «ورد اليوم» on the review day until read. */
export function SelfMessageCard({ heart, today }: { heart: HeartData; today: string }) {
  const t = useTranslations('practice.heart.selfMessage');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const review = selfMessageDue(heart, today);
  if (!review?.message) return null;
  return (
    <Card title={t('title')}>
      <p className="text-lg leading-8">{review.message}</p>
      <p className="text-sm text-muted-foreground">{t('from', { date: formatGregorian(review.weekOf, locale, false) })}</p>
      <Button size="sm" variant="outline" className="self-start" onClick={() => updateHeart((h) => markMessageSeen(h, review.weekOf))}>
        {t('read')}
      </Button>
    </Card>
  );
}

/** المشارطة: «نية اليوم» until noon (the one-time offer, the card, or one line once made). */
export function IntentionCard({ ctx }: { ctx: HeartContext }) {
  const t = useTranslations('practice.heart.intention');
  const english = useLocale() === 'en';
  const { store, heart, today, time, habits, planDays } = ctx;
  const state = intentionState(heart, today, time);
  const due = useMemo(
    () => dayAgenda(store, today, planDays).flatMap((i) => (i.kind === 'habit' ? store.plans.filter((p) => p.id === i.planId) : [])),
    [store, today, planDays],
  );
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [pledge, setPledge] = useState('');
  const inputId = useId();

  if (state === 'offer') {
    return (
      <Card title={t('offerTitle')}>
        <p className="text-sm leading-7 text-muted-foreground">{t('offerBody')}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => updateHeart((h) => setHeartPrefs(h, { intention: true }))}>
            {t('offerOn')}
          </Button>
          <Button size="sm" variant="ghost" tone="neutral" onClick={() => updateHeart((h) => setHeartPrefs(h, { intentionOfferDismissed: true }))}>
            {t('dismiss')}
          </Button>
        </div>
      </Card>
    );
  }
  if (state === 'made') {
    const made = intentionOf(heart, today);
    return (
      <p className="flex max-w-3xl items-start gap-2 text-sm leading-7 text-muted-foreground">
        <Check aria-hidden className="mt-1.5 size-4 shrink-0 text-primary-text" />
        <span>
          {t('made')}
          {made?.pledge ? <> · {t('pledgeLine', { text: made.pledge })}</> : null}
        </span>
      </p>
    );
  }
  if (state !== 'card') return null;

  return (
    <Card title={t('title')}>
      <p className="text-sm leading-7">{t('lead')}</p>
      {due.length === 0 ? (
        <p className="text-sm leading-7 text-muted-foreground">{t('noHabits')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {due.map((plan) => (
            <li key={plan.id}>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={!unticked.has(plan.id)}
                  onChange={(e) =>
                    setUnticked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(plan.id);
                      else next.add(plan.id);
                      return next;
                    })
                  }
                />
                {planTitle(plan, habits, english)}
              </label>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor={inputId} className="text-sm font-medium">
        {t('pledgeLabel')}
      </label>
      <Input id={inputId} value={pledge} maxLength={140} placeholder={t('pledgePlaceholder')} onChange={(e) => setPledge(e.target.value)} className="h-11" />
      <Button
        className="self-start"
        onClick={() =>
          updateHeart((h) => makeIntention(h, { date: today, planIds: due.filter((p) => !unticked.has(p.id)).map((p) => p.id), pledge }))
        }
      >
        {t('submit')}
      </Button>
    </Card>
  );
}

/** المعاقبة: «التزامك: …» after two missed asked days, with «وفيت به». Calm, never a penalty. */
export function PledgeCards({ ctx }: { ctx: HeartContext }) {
  const t = useTranslations('practice.heart.pledge');
  const english = useLocale() === 'en';
  const due = useMemo(() => pledgesDue(ctx.store, ctx.heart, ctx.today, ctx.planDays), [ctx.store, ctx.heart, ctx.today, ctx.planDays]);
  if (due.length === 0) return null;
  return (
    <>
      {due.map(({ pledge, on }) => {
        const plan = ctx.store.plans.find((p) => p.id === pledge.planId);
        return (
          <Card key={pledge.id} title={t('title', { text: pledgeText(pledge, english, t) })}>
            {plan ? <p className="text-sm leading-7 text-muted-foreground">{t('hint', { habit: quotedTitle(planTitle(plan, ctx.habits, english), english) })}</p> : null}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => updateHeart((h) => keepPledge(h, pledge.id, on))}>
                {t('kept')}
              </Button>
              <EvidenceButton ids={pledgeEvidence(pledge.action)} deed={pledgeText(pledge, english, t)} />
            </div>
          </Card>
        );
      })}
    </>
  );
}

/** المحاسبة (evening, opt-in): what was completed, the day's pledge kept or not, and the private check-in link. */
export function EveningCard({ ctx }: { ctx: HeartContext }) {
  const t = useTranslations('practice.heart.evening');
  const { store, heart, today, time, planDays } = ctx;
  const [kept, setKept] = useState<PledgeKept | null>(null);
  if (!eveningCardVisible(heart, today, time)) return null;
  const summary = daySummary(store, today, planDays);
  const intention = intentionOf(heart, today);
  const hasProgram = activePrograms(store.programs).length > 0;
  return (
    <Card title={t('title')}>
      <p className="text-sm font-medium">{t('doneQ')}</p>
      <p className="text-sm leading-7 text-muted-foreground">
        {t('doneSummary', { total: summary.asked.length, totalN: formatDigits(summary.asked.length), done: formatDigits(summary.done.length) })}
      </p>
      {intention?.pledge ? (
        <>
          <p className="text-sm font-medium">{t('keptQ')}</p>
          <p className="text-sm leading-7 text-muted-foreground">{intention.pledge}</p>
          <Chips
            label={t('keptQ')}
            value={kept}
            onChange={setKept}
            options={(['yes', 'partly', 'no'] as const).map((k) => ({ key: k, text: t(k) }))}
          />
        </>
      ) : null}
      {hasProgram ? (
        <Link href="/practice/leave-sin" className="text-link self-start text-sm">
          {t('checkIn')}
        </Link>
      ) : null}
      <Button size="sm" className="self-start" onClick={() => updateHeart((h) => saveEvening(h, { date: today, ...(kept ? { kept } : {}) }))}>
        {t('save')}
      </Button>
    </Card>
  );
}

/** «المحاسبة الأسبوعية» (the chosen day; the next morning if skipped): kept, weakened, one step, the heart, a line to oneself. */
export function WeeklyCard({ ctx }: { ctx: HeartContext }) {
  const t = useTranslations('practice.heart.weekly');
  const english = useLocale() === 'en';
  const { store, heart, today, time, habits, planDays } = ctx;
  const weekOf = weeklyReviewDue(heart, today, time);
  const summary = useMemo(() => (weekOf ? weekSummary(store, weekOf, today, planDays) : null), [store, weekOf, today, planDays]);
  const candidates = useMemo(() => store.plans.filter((p) => !p.pausedOn || p.resumedOn), [store.plans]);
  const firstPlan = summary?.weak[0]?.planId ?? summary?.steady[0]?.planId ?? candidates[0]?.id ?? null;
  const [planId, setPlanId] = useState<string | null>(null);
  const [choice, setChoice] = useState<StepChoice>('keep');
  const [feeling, setFeeling] = useState<HeartFeeling | null>(null);
  const [message, setMessage] = useState('');
  const messageId = useId();
  if (!weekOf || !summary) return null;

  const selectedId = planId ?? firstPlan;
  const selected = store.plans.find((p) => p.id === selectedId) ?? null;
  const choices = selected ? stepChoices(selected, today) : [];
  const byId = (id: string) => store.plans.find((p) => p.id === id);
  const title = (id: string) => {
    const plan = byId(id);
    return plan ? planTitle(plan, habits, english) : '';
  };

  function save() {
    if (!weekOf || !summary) return;
    const step = selected && choices.includes(choice) ? { planId: selected.id, choice } : undefined;
    if (step && step.choice !== 'keep') {
      updateStore((s) => updatePlan(s, step.planId, (p) => applyStep(p, step.choice, today)));
    }
    updateHeart((h) =>
      saveWeeklyReview(h, {
        weekOf,
        steady: summary.steady.map((r) => ({ planId: r.planId, title: title(r.planId), missed: 0 })),
        weak: summary.weak.map((r) => ({ planId: r.planId, title: title(r.planId), missed: r.missed })),
        ...(step ? { step } : {}),
        ...(feeling ? { heart: feeling } : {}),
        message,
      }),
    );
  }

  return (
    <Card title={t('title')}>
      <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
      <h3 className="text-base font-medium">{t('steady')}</h3>
      {summary.steady.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm leading-7">
          {summary.steady.map((r) => (
            <li key={r.planId} className="flex items-center gap-2">
              <Check aria-hidden className="size-4 text-primary-text" />
              {title(r.planId)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-7 text-muted-foreground">{t('steadyNone')}</p>
      )}
      <h3 className="text-base font-medium">{t('weak')}</h3>
      {summary.weak.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm leading-7">
          {summary.weak.map((r) => (
            <li key={r.planId}>
              {title(r.planId)} · <span className="text-muted-foreground">{t('missed', { count: r.missed, n: formatDigits(r.missed) })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-7 text-muted-foreground">{t('weakNone')}</p>
      )}
      {candidates.length > 0 ? (
        <>
          <h3 className="text-base font-medium">{t('step')}</h3>
          <Chips
            label={t('stepHabit')}
            value={selectedId}
            onChange={(id) => {
              setPlanId(id);
              setChoice('keep');
            }}
            options={candidates.map((p) => ({ key: p.id, text: planTitle(p, habits, english) }))}
          />
          <Chips label={t('step')} value={choice} onChange={setChoice} options={choices.map((c) => ({ key: c, text: t(c) }))} />
        </>
      ) : null}
      <h3 className="text-base font-medium">{t('heart')}</h3>
      <Chips label={t('heart')} value={feeling} onChange={setFeeling} options={(['present', 'middle', 'hard'] as const).map((k) => ({ key: k, text: t(k) }))} />
      <label htmlFor={messageId} className="text-base font-medium">
        {t('message')}
      </label>
      <Input id={messageId} value={message} maxLength={140} placeholder={t('messagePlaceholder')} onChange={(e) => setMessage(e.target.value)} className="h-11" />
      <Button className="self-start" onClick={save}>
        {t('save')}
      </Button>
    </Card>
  );
}

/**
 * Under the header of «ورد اليوم», in order: «نية اليوم» until noon, a pledge that came due, the Friday review, then the evening review. Each hides itself when it has nothing to say.
 */
export function HeartTop({ ctx }: { ctx: HeartContext }) {
  return (
    <div className="flex max-w-3xl flex-col gap-4 empty:hidden">
      <IntentionCard ctx={ctx} />
      <PledgeCards ctx={ctx} />
      <WeeklyCard ctx={ctx} />
      <EveningCard ctx={ctx} />
    </div>
  );
}
