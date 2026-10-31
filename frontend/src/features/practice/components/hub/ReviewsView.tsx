'use client';

import { useLocale, useTranslations } from 'next-intl';
import { reviewHistory } from '@thekra/practice-core';
import { formatDigits } from '@/lib/format/digits';
import { formatGregorian } from '@/lib/practice/format';
import { useHeart } from '../../hooks/useHeart';
import { useWirdContext } from '../../hooks/useWirdContext';
import { PracticeLoading } from '../PracticeLoading';
import { planTitle } from './HeartCards';

/** «المحاسبة» in «سجلّي»: every weekly review on this device, newest first, read-only. */
export function ReviewsView() {
  const t = useTranslations('practice.heart.reviews');
  const tWeekly = useTranslations('practice.heart.weekly');
  const locale = useLocale() === 'en' ? 'en' : 'ar';
  const context = useWirdContext();
  const heart = useHeart();
  if (!context || !heart) return <PracticeLoading />;
  const reviews = reviewHistory(heart);
  if (reviews.length === 0) return <p className="text-muted-foreground">{t('empty')}</p>;

  const titleOf = (planId: string, stored: string) => {
    const plan = context.snapshot.store.plans.find((p) => p.id === planId);
    return plan ? planTitle(plan, context.habits, locale === 'en') : stored;
  };

  return (
    <ol className="flex max-w-3xl flex-col gap-4">
      {reviews.map((review) => {
        const stepTitle = review.step
          ? titleOf(review.step.planId, [...review.steady, ...review.weak].find((r) => r.planId === review.step?.planId)?.title ?? '')
          : null;
        return (
          <li key={review.weekOf} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-medium">{t('weekOf', { date: formatGregorian(review.weekOf, locale, false) })}</h2>
            <p className="text-sm leading-7">
              <span className="font-medium">{tWeekly('steady')}: </span>
              {review.steady.length > 0 ? review.steady.map((r) => titleOf(r.planId, r.title)).join(locale === 'ar' ? '، ' : ', ') : tWeekly('steadyNone')}
            </p>
            <p className="text-sm leading-7">
              <span className="font-medium">{tWeekly('weak')}: </span>
              {review.weak.length > 0
                ? review.weak
                    .map((r) => `${titleOf(r.planId, r.title)} (${tWeekly('missed', { count: r.missed, n: formatDigits(r.missed) })})`)
                    .join(locale === 'ar' ? '، ' : ', ')
                : tWeekly('weakNone')}
            </p>
            {review.step && stepTitle ? (
              <p className="text-sm leading-7">{t('step', { habit: stepTitle, choice: tWeekly(review.step.choice) })}</p>
            ) : null}
            {review.heart ? <p className="text-sm leading-7">{t('heart', { value: tWeekly(review.heart) })}</p> : null}
            {review.message ? <p className="text-sm leading-7 text-muted-foreground">{t('message', { text: review.message })}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
