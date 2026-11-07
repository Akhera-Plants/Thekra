/**
 * «المحاسبة» (redesign §4.4): every weekly review on this device, newest first, read-only. Device-local, never synced.
 * Empty: an icon-led state with one bordered way forward: this week's review on «ورد اليوم» when it is due, otherwise
 * the review's settings (its day and time) in «التنبيهات».
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck } from 'lucide-react-native';
import { reviewHistory, weeklyReviewDue } from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { weekRangeTitle } from '@/lib/practice/calendar-grid';
import { nowTime } from '@/lib/practice/format';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { planTitleOf } from '@/components/practice/hub/HeartCards';
import { space, useStyles, type Theme } from '@/theme';
import { EmptyState, PageHeader, Screen, Section, Text } from '@/ui';

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
  const dueNow = reviews.length === 0 && weeklyReviewDue(heart, today(), nowTime()) !== null;
  const sep = locale === 'ar' ? '، ' : ', ';
  const titleOf = (planId: string, stored: string) => {
    const plan = plans.find((p) => p.id === planId);
    return plan ? planTitleOf(plan, habits, locale) : stored;
  };

  return (
    <Screen edges={['bottom']}>
      <PageHeader title={t('practice.heart.reviews.title')} lead={t('practice.heart.reviews.lead')} />
      <Section>
        {reviews.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            message={t('practice.heart.reviews.empty')}
            hint={t('practice.heart.reviews.emptyHint')}
            actionLabel={t(dueNow ? 'practice.heart.reviews.start' : 'practice.heart.reviews.settings')}
            onAction={dueNow ? () => router.navigate('/(tabs)/habits') : () => router.push('/settings/notifications')}
          />
        ) : (
          reviews.map((review) => {
            const stepPlan = review.step ? [...review.steady, ...review.weak].find((r) => r.planId === review.step?.planId) : undefined;
            return (
              <View key={review.weekOf} style={styles.item}>
                <Text variant="heading">{t('practice.heart.reviews.weekOf', { date: weekRangeTitle(review.weekOf, names) })}</Text>
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
