'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  activePrograms,
  addDays,
  addSelfMessage,
  applyStep,
  cleanSelfMessage,
  periodAnswers,
  REVIEW_STEP_ROWS,
  SELF_MESSAGE_MAX_LENGTH,
  SELF_MESSAGES_MAX,
  selfMessageError,
  dayAgenda,
  daySummary,
  eveningCardVisible,
  HEART_LINE_MAX,
  intentionOf,
  intentionState,
  makeIntention,
  markMessageSeen,
  muraqabaQuoteId,
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
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Button } from '@/components/shared/kit/button';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateHeart } from '@/lib/practice/heart-store';
import { updateStore } from '@/lib/practice/local-store';
import { newUuid } from '@/lib/practice/ids';
import { habitOf } from '@/lib/practice/plans';
import { useReviewDraft } from '@/lib/practice/review-draft';
import type { PracticeHabit } from '@/lib/types/practice';
import { cn } from '@/lib/utils';
import { TextSourceLine } from '@/components/shared/quote/TextSourceLine';
import { stripOuterQuotes } from '@/lib/texts/quote-text';
import { usePracticeEvidence } from '../../hooks/usePracticeEvidence';
import { NoteField, nextFieldOnEnter, REVIEW_FIELD } from './ReviewFields';

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

/** Inside the heart slot's dialog (`bare`), the dialog gives the title and frame: the card shows its body only. */
export interface HeartCardProps {
  ctx: HeartContext;
  bare?: boolean;
  /** After its save (the dialog closes and says so), or `dismissed` («ليس الآن»: it only closes). */
  onSaved?: (what?: 'dismissed') => void;
}

function Card({ title, children, labelledBy, bare = false }: { title: ReactNode; children: ReactNode; labelledBy?: string; bare?: boolean }) {
  const id = useId();
  if (bare) return <div className="flex flex-col gap-3">{children}</div>;
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
export function IntentionCard({ ctx, bare = false, onSaved }: HeartCardProps) {
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
      <Card title={t('offerTitle')} bare={bare}>
        <p className="text-sm leading-7 text-muted-foreground">{t('offerBody')}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => updateHeart((h) => setHeartPrefs(h, { intention: true }))}>
            {t('offerOn')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            tone="neutral"
            onClick={() => {
              updateHeart((h) => setHeartPrefs(h, { intentionOfferDismissed: true }));
              onSaved?.('dismissed');
            }}
          >
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
    <Card title={t('title')} bare={bare}>
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
        onClick={() => {
          updateHeart((h) => makeIntention(h, { date: today, planIds: due.filter((p) => !unticked.has(p.id)).map((p) => p.id), pledge }));
          onSaved?.();
        }}
      >
        {t('submit')}
      </Button>
    </Card>
  );
}

/** «زِد خطوة / خفّف / أبقِ» for one habit: a tap chooses, a second tap on the same chip clears it (no step). */
function StepChips({ label, value, options, onChange }: { label: string; value: StepChoice | undefined; options: StepChoice[]; onChange: (v: StepChoice | undefined) => void }) {
  const t = useTranslations('practice.heart.weekly');
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value === c}
          onClick={() => onChange(value === c ? undefined : c)}
          className={cn(
            'min-h-11 rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
            value === c ? 'border-primary bg-secondary text-primary-text' : 'border-border hover:bg-muted',
          )}
        >
          {t(c)}
        </button>
      ))}
    </div>
  );
}

/** A small heading inside a form. */
function FormHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-medium">{children}</h3>;
}

/** The save row stays at the foot of the dialog's scroll area, so «احفظ» is always in reach on a long form. */
function SaveBar({ children, bare }: { children: ReactNode; bare: boolean }) {
  return <div className={cn(bare && 'sticky bottom-0 -mx-1 border-t border-border bg-background px-1 pt-3 pb-1')}>{children}</div>;
}

/**
 * المحاسبة (evening, opt-in), a form (round 8): what was completed, the day's pledge kept or not, then the member's own
 * words, all optional: «ما أعانك اليوم؟», «ما صعّب عليك اليوم؟» (the day's own answers to the daily question as chips) and
 * «خطوة لغد». Saves with every field empty too.
 */
export function EveningCard({ ctx, bare = false, onSaved }: HeartCardProps) {
  const t = useTranslations('practice.heart.evening');
  const { store, heart, today, time, planDays } = ctx;
  const { draft, patch, clear } = useReviewDraft(`evening:${today}`, { kept: null as PledgeKept | null, helped: '', hard: '', tomorrow: '' });
  const answers = useMemo(() => periodAnswers(store, today, today), [store, today]);
  // In the dialog the card stays until it closes (the slot is gone once saved).
  if (!bare && !eveningCardVisible(heart, today, time)) return null;
  const summary = daySummary(store, today, planDays);
  const intention = intentionOf(heart, today);
  const hasProgram = activePrograms(store.programs).length > 0;
  return (
    <Card title={t('title')} bare={bare}>
      <div data-review-form className="flex flex-col gap-5">
        <p className="text-sm leading-7 text-muted-foreground">
          {t('doneSummary', { total: summary.asked.length, totalN: formatDigits(summary.asked.length), done: formatDigits(summary.done.length) })}
        </p>
        {intention?.pledge ? (
          <div className="flex flex-col gap-2">
            <FormHeading>{t('keptQ')}</FormHeading>
            <p className="text-sm leading-7 text-muted-foreground">{intention.pledge}</p>
            <Chips
              label={t('keptQ')}
              value={draft.kept}
              onChange={(kept) => patch({ kept })}
              options={(['yes', 'partly', 'no'] as const).map((k) => ({ key: k, text: t(k) }))}
            />
          </div>
        ) : null}
        <NoteField label={t('helpedQ')} value={draft.helped} onChange={(helped) => patch({ helped })} answers={answers.helped} answersLabel={t('fromDaily')} />
        <NoteField label={t('hardQ')} value={draft.hard} onChange={(hard) => patch({ hard })} answers={answers.hard} answersLabel={t('fromDaily')} />
        <NoteField label={t('tomorrowQ')} value={draft.tomorrow} onChange={(tomorrow) => patch({ tomorrow })} placeholder={t('tomorrowPlaceholder')} />
        {/* «تمّت المحاسبة» and «سجّل حالك في برنامجك الخاص» are one choice (O-02): side by side, the same size, the save
            solid and the check-in outlined, as in the app. Without a program the save stands alone. */}
        <SaveBar bare={bare}>
          <ActionPair layout={hasProgram ? 'fill' : 'hug'}>
            {/* A long label wraps inside its button; the two keep one height (grid row), never overflow. */}
            <Button
              className="h-auto min-h-11 whitespace-normal py-2 leading-6"
              onClick={() => {
                updateHeart((h) =>
                  saveEvening(h, { date: today, ...(draft.kept ? { kept: draft.kept } : {}), helped: draft.helped, hard: draft.hard, tomorrow: draft.tomorrow }),
                );
                clear();
                onSaved?.();
              }}
            >
              {t('save')}
            </Button>
            {hasProgram ? (
              <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-6">
                <Link href="/practice/leave-sin">{t('checkIn')}</Link>
              </Button>
            ) : null}
          </ActionPair>
        </SaveBar>
      </div>
    </Card>
  );
}

/**
 * «المحاسبة الأسبوعية» as a form (round 8; the chosen day, the next morning if skipped): the week's facts as a compact
 * context, then the member's own words («ما الذي أعانك؟», «ما الذي صعّب عليك؟», «ماذا ستغيّر؟»; the week's daily
 * answers are one-tap chips), a step per listed habit, the heart with an optional line and an optional message to
 * himself (saved to «رسائلي إلى نفسي»). Nothing is required; what is typed survives an accidental close until saved.
 */
export function WeeklyCard({ ctx, bare = false, onSaved, weekOf: forced }: HeartCardProps & { weekOf?: string }) {
  const t = useTranslations('practice.heart.weekly');
  const english = useLocale() === 'en';
  const { store, heart, today, time, habits, planDays } = ctx;
  // «ابدأ محاسبة الأسبوع» in «محاسبتي» opens the review for the current week even on another day (`weekOf`).
  const weekOf = forced ?? weeklyReviewDue(heart, today, time);
  const summary = useMemo(() => (weekOf ? weekSummary(store, weekOf, today, planDays) : null), [store, weekOf, today, planDays]);
  const answers = useMemo(() => (weekOf ? periodAnswers(store, addDays(weekOf, -6), weekOf) : { helped: [], hard: [] }), [store, weekOf]);
  const { draft, patch, clear } = useReviewDraft(`weekly:${weekOf ?? ''}`, {
    helped: '',
    hard: '',
    change: '',
    steps: {} as Record<string, StepChoice | undefined>,
    feeling: null as HeartFeeling | null,
    heartNote: '',
    message: '',
  });
  if (!weekOf || !summary) return null;

  const byId = (id: string) => store.plans.find((p) => p.id === id);
  const title = (id: string) => {
    const plan = byId(id);
    return plan ? planTitle(plan, habits, english) : '';
  };
  // The hardest habits get a step row; a week with none missed offers the steady ones instead.
  const rows = (summary.weak.length > 0 ? summary.weak : summary.steady).filter((r) => byId(r.planId)).slice(0, REVIEW_STEP_ROWS);
  const messagesFull = (heart.messages?.length ?? 0) >= SELF_MESSAGES_MAX;

  function save() {
    if (!weekOf || !summary) return;
    const steps = rows.flatMap((r) => {
      const plan = byId(r.planId);
      const choice = draft.steps[r.planId];
      return plan && choice && stepChoices(plan, today).includes(choice) ? [{ planId: r.planId, choice }] : [];
    });
    const applied = steps.filter((s) => s.choice !== 'keep');
    if (applied.length > 0) {
      updateStore((s) => applied.reduce((acc, st) => updatePlan(acc, st.planId, (p) => applyStep(p, st.choice, today)), s));
    }
    updateHeart((h) => {
      const next = saveWeeklyReview(h, {
        weekOf,
        steady: summary.steady.map((r) => ({ planId: r.planId, title: title(r.planId), missed: 0 })),
        weak: summary.weak.map((r) => ({ planId: r.planId, title: title(r.planId), missed: r.missed })),
        ...(steps.length > 0 ? { steps } : {}),
        ...(draft.feeling ? { heart: draft.feeling } : {}),
        helped: draft.helped,
        hard: draft.hard,
        change: draft.change,
        heartNote: draft.heartNote,
      });
      // The message goes to the list at the top of «عاداتي» (the usual limits: 280 characters, ten messages).
      return cleanSelfMessage(draft.message) && !selfMessageError(next, draft.message) ? addSelfMessage(next, { id: newUuid(), text: draft.message }) : next;
    });
    clear();
    onSaved?.();
  }

  const hasFacts = summary.steady.length > 0 || summary.weak.length > 0;
  return (
    <Card title={t('title')} bare={bare}>
      <div data-review-form className="flex flex-col gap-5">
        <p className="text-sm leading-7 text-muted-foreground">{t('lead')}</p>
        <ul aria-label={t('weekFacts')} className="flex flex-col gap-1 rounded-xl border border-border px-3 py-2 text-sm leading-7">
          {hasFacts ? null : <li className="text-muted-foreground">{t('steadyNone')}</li>}
          {summary.steady.map((r) => (
            <li key={r.planId} className="flex items-center gap-2">
              <Check aria-hidden className="size-4 shrink-0 text-primary-text" />
              <span className="min-w-0 break-words">{title(r.planId)}</span>
            </li>
          ))}
          {summary.weak.map((r) => (
            <li key={r.planId} className="flex items-baseline justify-between gap-3 ps-6">
              <span className="min-w-0 break-words">{title(r.planId)}</span>
              <span className="shrink-0 text-muted-foreground">{t('missed', { count: r.missed, n: formatDigits(r.missed) })}</span>
            </li>
          ))}
        </ul>
        <NoteField label={t('helpedQ')} value={draft.helped} onChange={(helped) => patch({ helped })} answers={answers.helped} answersLabel={t('fromDaily')} />
        <NoteField label={t('hardQ')} value={draft.hard} onChange={(hard) => patch({ hard })} answers={answers.hard} answersLabel={t('fromDaily')} />
        <NoteField label={t('changeQ')} value={draft.change} onChange={(change) => patch({ change })} />
        {rows.length > 0 ? (
          <div className="flex flex-col gap-3">
            <FormHeading>{t('step')}</FormHeading>
            <ul className="flex flex-col gap-4">
              {rows.map((r) => {
                const plan = byId(r.planId);
                if (!plan) return null;
                return (
                  <li key={r.planId} className="flex flex-col gap-2">
                    <p className="text-sm leading-7">{title(r.planId)}</p>
                    <StepChips
                      label={title(r.planId)}
                      value={draft.steps[r.planId]}
                      options={stepChoices(plan, today)}
                      onChange={(choice) => patch({ steps: { ...draft.steps, [r.planId]: choice } })}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <FormHeading>{t('heart')}</FormHeading>
          <Chips label={t('heart')} value={draft.feeling} onChange={(feeling) => patch({ feeling })} options={(['present', 'middle', 'hard'] as const).map((k) => ({ key: k, text: t(k) }))} />
          <Input
            {...{ [REVIEW_FIELD]: '' }}
            value={draft.heartNote}
            maxLength={HEART_LINE_MAX}
            placeholder={t('heartNotePlaceholder')}
            aria-label={t('heartNoteLabel')}
            enterKeyHint="next"
            onChange={(e) => patch({ heartNote: e.target.value })}
            onKeyDown={nextFieldOnEnter}
            className="h-11"
          />
        </div>
        {messagesFull ? (
          <div className="flex flex-col gap-1">
            <FormHeading>{t('messageLabel')}</FormHeading>
            <p className="text-sm leading-7 text-muted-foreground">{t('messageFull', { max: formatDigits(SELF_MESSAGES_MAX) })}</p>
          </div>
        ) : (
          <NoteField label={t('messageLabel')} value={draft.message} onChange={(message) => patch({ message })} placeholder={t('messagePlaceholder')} max={SELF_MESSAGE_MAX_LENGTH} />
        )}
        <SaveBar bare={bare}>
          <Button className="self-start" onClick={save}>
            {t('save')}
          </Button>
        </SaveBar>
      </div>
    </Card>
  );
}
