'use client';

import { useId, useState, type ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  eveningOf,
  intentionOf,
  intentionState,
  markMessageSeen,
  reviewHistory,
  setHeartPrefs,
  weeklyOf,
  weeklyReviewDue,
  type WeeklyReview,
} from '@thekra/practice-core';
import { Button } from '@/components/shared/kit/button';
import { ActionPair } from '@/components/shared/kit/action-pair';
import { Switch } from '@/components/shared/kit/switch';
import { TitleRow } from '@/components/shared/kit/title-row';
import { SectionDivider } from '@/components/shared/SectionDivider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { updateHeart } from '@/lib/practice/heart-store';
import { notificationPrefsOf, updatePrefs } from '@/lib/practice/local-store';
import { resendPushPrefs } from '@/lib/push/web-push';
import { useHeart } from '../../hooks/useHeart';
import { useWirdContext, type WirdContext } from '../../hooks/useWirdContext';
import { EveningCard, IntentionCard, planTitle, WeeklyCard, type HeartContext } from '../hub/HeartCards';
import { PracticeLoading } from '../PracticeLoading';

/** Archive rows shown before «المزيد» (A-12 a: short lists). */
const ARCHIVE_SHOWN = 4;

/**
 * «عاداتي › محاسبتي» (round 5, F-07 a): «نية اليوم» (its switch lives here), «محاسبة المساء» (start it now), the weekly
 * review (start it now, or pick its day: W-19 b, no fixed Friday), «رسائلي» (the lines written to oneself) and the
 * archive as short lists (A-12 a). Everything is on this device and synced with the heart data.
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

type Open = 'intention' | 'evening' | 'weekly' | 'day' | null;

function ReviewBody({ ctx, context }: { ctx: HeartContext; context: WirdContext }) {
  const t = useTranslations('practice.review');
  const tIntention = useTranslations('practice.heart.intention');
  const tDays = useTranslations('practice.weekdays');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const { heart, today, time } = ctx;
  const [open, setOpen] = useState<Open>(null);
  const intention = intentionOf(heart, today);
  const state = intentionState(heart, today, time);
  const evening = eveningOf(heart, today);
  const weekDue = weeklyReviewDue(heart, today, time);
  const weekOf = weekDue ?? today;
  const weekSaved = weeklyOf(heart, today) !== undefined;
  const reviews = reviewHistory(heart);
  const messages = reviews.filter((r) => r.message);

  function saved(message: string) {
    setOpen(null);
    toast.success(message);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
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

      <Section id="review-evening" title={t('eveningTitle')}>
        <p className="text-sm leading-7 text-muted-foreground">{evening ? t('eveningDone') : t('eveningHint')}</p>
        {evening ? null : (
          <Button variant="outline" tone="primary" size="sm" className="self-start" onClick={() => setOpen('evening')}>
            {t('startNow')}
          </Button>
        )}
      </Section>

      <SectionDivider />

      <Section id="review-weekly" title={t('weeklyTitle')}>
        <p className="text-sm leading-7 text-muted-foreground">
          {weekSaved
            ? t('weeklyDone')
            : heart.prefs.fridayReview
              ? t('weeklyDay', { day: tDays(`d${heart.prefs.reviewDay}`) })
              : t('weeklyOff')}
        </p>
        {reviews.length === 0 && !weekSaved ? <p className="text-base leading-8">{t('emptyLead')}</p> : null}
        <ActionPair className="sm:max-w-md">
          <Button onClick={() => setOpen('weekly')} disabled={weekSaved}>
            {t('reviewNow')}
          </Button>
          <Button variant="outline" tone="primary" icon={<CalendarDays aria-hidden />} onClick={() => setOpen('day')}>
            {t('pickDay')}
          </Button>
        </ActionPair>
      </Section>

      <SectionDivider />

      <Section id="review-messages" title={t('messagesTitle')}>
        {messages.length === 0 ? (
          <p className="text-sm leading-7 text-muted-foreground">{t('messagesEmpty')}</p>
        ) : (
          <ShortList
            items={messages}
            render={(review) => (
              <li key={review.weekOf} className="flex flex-col gap-1 py-3">
                <p className="text-base leading-8">{review.message}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {t('writtenOn', { date: formatGregorian(review.weekOf, locale, false) })}
                  {!review.messageSeen ? (
                    <Button variant="ghost" tone="primary" size="sm" onClick={() => updateHeart((h) => markMessageSeen(h, review.weekOf))}>
                      {t('markRead')}
                    </Button>
                  ) : null}
                </p>
              </li>
            )}
          />
        )}
      </Section>

      <SectionDivider />

      <Section id="review-archive" title={t('archiveTitle')}>
        {reviews.length === 0 ? (
          <p className="text-sm leading-7 text-muted-foreground">{t('archiveEmpty')}</p>
        ) : (
          <ShortList items={reviews} render={(review) => <ArchiveRow key={review.weekOf} review={review} context={context} />} />
        )}
      </Section>

      <Dialog open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-lg">
          <DialogHeader className="pe-8">
            <DialogTitle className="leading-8">
              {open === 'intention'
                ? tIntention('title')
                : open === 'evening'
                  ? t('eveningTitle')
                  : open === 'weekly'
                    ? t('weeklyTitle')
                    : t('pickDay')}
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
        <h2 id={id} className="text-xl font-medium">
          {title}
        </h2>
      </TitleRow>
      {children}
    </section>
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

/** One weekly review: the week, then the habits as short rows with «فاتك n» as a badge (the two weakest first). */
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
      {review.weak.length > 2 ? (
        <p className="text-xs text-muted-foreground">{t('moreWeak', { n: formatDigits(review.weak.length - 2) })}</p>
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
