/** «المحاسبة» (redesign §4.4): every weekly review on this device, newest first, read-only. Device-local, never synced. */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { reviewHistory } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { shortDayTitle } from '@/lib/practice/calendar-grid';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { planTitleOf } from '@/components/practice/hub/HeartCards';
import { space, useStyles, type Theme } from '@/theme';
import { PageHeader, Screen, Section, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  item: { paddingVertical: space.md, gap: space.xs, borderBottomWidth: 1, borderBottomColor: t.colors.border },
});

export default function ReviewsScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const heart = usePracticeStore((s) => s.heart);
  const plans = usePracticeStore((s) => s.store.plans);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const reviews = reviewHistory(heart);
  const sep = locale === 'ar' ? '، ' : ', ';
  const titleOf = (planId: string, stored: string) => {
    const plan = plans.find((p) => p.id === planId);
    return plan ? planTitleOf(plan, habits, locale) : stored;
  };

  return (
    <Screen edges={['bottom']} decor>
      <PageHeader title={t('practice.heart.reviews.title')} lead={t('practice.heart.reviews.lead')} />
      <Section>
        {reviews.length === 0 ? (
          <Text variant="body" tone="muted">
            {t('practice.heart.reviews.empty')}
          </Text>
        ) : (
          reviews.map((review) => {
            const stepPlan = review.step ? [...review.steady, ...review.weak].find((r) => r.planId === review.step?.planId) : undefined;
            return (
              <View key={review.weekOf} style={styles.item}>
                <Text variant="heading">{t('practice.heart.reviews.weekOf', { date: shortDayTitle(review.weekOf, names) })}</Text>
                <Text variant="small">
                  {`${t('practice.heart.weekly.steady')}: ${review.steady.length ? review.steady.map((r) => titleOf(r.planId, r.title)).join(sep) : t('practice.heart.weekly.steadyNone')}`}
                </Text>
                <Text variant="small">
                  {`${t('practice.heart.weekly.weak')}: ${
                    review.weak.length
                      ? review.weak.map((r) => `${titleOf(r.planId, r.title)} (${t('practice.heart.weekly.missed', { count: r.missed })})`).join(sep)
                      : t('practice.heart.weekly.weakNone')
                  }`}
                </Text>
                {review.step ? (
                  <Text variant="small">
                    {t('practice.heart.reviews.step', {
                      habit: titleOf(review.step.planId, stepPlan?.title ?? ''),
                      choice: t(`practice.heart.weekly.${review.step.choice}`),
                    })}
                  </Text>
                ) : null}
                {review.heart ? (
                  <Text variant="small">{t('practice.heart.reviews.heart', { value: t(`practice.heart.weekly.${review.heart}`) })}</Text>
                ) : null}
                {review.message ? (
                  <Text variant="small" tone="muted">
                    {t('practice.heart.reviews.message', { text: review.message })}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </Section>
    </Screen>
  );
}
