/**
 * «عاداتي › محاسبتي» (owner round 5, §1 IA; F-07 a, A-12 a, A-25 a): the self-review in one place, each part a short
 * section divided by the flower divider:
 * - «نية اليوم»: its switch lives here; «ابدأ» opens the intention sheet in the morning;
 * - «محاسبة المساء»: «ابدأ الآن» at any hour (the card on «ورد اليوم» comes from the user's time);
 * - «المحاسبة الأسبوعية»: «ابدأ» (the week closing on the last review day) and when the last one was;
 * - «رسائلي إلى نفسي»: the lines written in the weekly reviews, newest first;
 * - the archive: each review as a short list, one line per habit with «فاتك n», the weakest two and «المزيد».
 * With no review yet: «حاسب نفسك الآن» beside «اختر اليوم» (the review day). Device-local, never synced.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ClipboardCheck, Mail, Moon, Sun } from 'lucide-react-native';
import {
  eveningOf,
  INTENTION_UNTIL,
  intentionOf,
  reviewHistory,
  setHeartPrefs,
  weeklyOf,
  type LocalDate,
} from '@thekra/practice-core';
import { usePracticeCatalog } from '@/lib/api/practice';
import { weekRangeTitle } from '@/lib/practice/calendar-grid';
import { nowTime } from '@/lib/practice/format';
import { lastReviewDay, reviewLines, type HeartSheet } from '@/lib/practice/habits-view';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useDateNames } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { WeekdayPicker } from '@/components/practice/editors';
import { HabitLines, HeartSheetView, planTitleOf } from '@/components/practice/hub/HeartCards';
import { space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ButtonPair, EmptyState, Icon, ListRow, Section, SectionDivider, SwitchRow, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  root: { gap: space['2xl'] },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  review: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  message: { gap: 2, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border },
});

export function ReviewTab({ today }: { today: LocalDate }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const plans = usePracticeStore((s) => s.store.plans);
  const habits = usePracticeCatalog(locale).data?.habits ?? [];
  const [sheet, setSheet] = useState<HeartSheet | null>(null);
  const [pickingDay, setPickingDay] = useState(false);
  const reviews = reviewHistory(heart);
  const messages = reviews.filter((r) => r.message);
  const weekOf = lastReviewDay(today, heart.prefs.reviewDay);
  const thisWeek = weeklyOf(heart, weekOf);
  const morning = nowTime() < INTENTION_UNTIL;
  const intention = intentionOf(heart, today);
  const evening = eveningOf(heart, today);
  const titleOf = (planId: string, stored: string) => {
    const plan = plans.find((p) => p.id === planId);
    return plan ? planTitleOf(plan, habits, locale) : stored;
  };
  const dayName = t(`practice.weekdays.${heart.prefs.reviewDay}`);

  return (
    <View style={styles.root}>
      <Section title={t('practice.heart.intention.title')}>
        <SwitchRow
          label={t('habitsTab.review.intentionSwitch')}
          hint={t('practice.onboarding.intentionHint')}
          value={heart.prefs.intention}
          onValueChange={(on) => {
            setHeart((h) => setHeartPrefs(h, { intention: on }));
            toast(t(on ? 'habitsTab.heart.intentionOnToast' : 'habitsTab.review.intentionOffToast'));
          }}
        />
        {heart.prefs.intention && morning ? (
          <ReviewRow
            icon={Sun}
            title={intention ? t('practice.heart.intention.made') : t('habitsTab.heart.intentionLine')}
            action={t(intention ? 'habitsTab.review.edit' : 'habitsTab.heart.start')}
            onPress={() => setSheet('intention')}
          />
        ) : null}
      </Section>

      <SectionDivider />

      <Section title={t('practice.heart.evening.title')}>
        <ReviewRow
          icon={Moon}
          title={evening ? t('habitsTab.review.eveningDone') : t('habitsTab.review.eveningLine')}
          action={t(evening ? 'habitsTab.review.again' : 'habitsTab.review.startNow')}
          onPress={() => setSheet('evening')}
        />
      </Section>

      <SectionDivider />

      <Section title={t('habitsTab.review.weeklyTitle')} lead={reviews.length === 0 ? t('habitsTab.review.weeklyDay', { day: dayName }) : undefined}>
        {reviews.length === 0 ? (
          <EmptyState icon={ClipboardCheck} message={t('practice.heart.reviews.empty')} hint={t('practice.heart.reviews.emptyHint')} />
        ) : (
          <ReviewRow
            icon={ClipboardCheck}
            title={
              thisWeek
                ? t('habitsTab.review.weeklyDone', { date: weekRangeTitle(weekOf, names) })
                : t('habitsTab.review.weeklyLast', { date: weekRangeTitle(reviews[0]!.weekOf, names) })
            }
            action={t(thisWeek ? 'habitsTab.review.again' : 'habitsTab.heart.start')}
            onPress={() => setSheet('weekly')}
          />
        )}
        {reviews.length === 0 ? (
          <ButtonPair
            primary={{ label: t('habitsTab.review.startWeekly'), onPress: () => setSheet('weekly') }}
            secondary={{ label: t('habitsTab.review.pickDay'), onPress: () => setPickingDay(true) }}
          />
        ) : (
          // A-07 / A-29: the day is a value row (title, the day, chevron) like the notification times, not a lone button.
          <ListRow icon={CalendarDays} title={t('habitsTab.review.dayRow')} value={dayName} chevron last onPress={() => setPickingDay(true)} />
        )}
      </Section>

      {messages.length > 0 ? (
        <>
          <SectionDivider />
          <Section title={t('habitsTab.review.messagesTitle')}>
            <View>
              {messages.slice(0, 5).map((r) => (
                <View key={r.weekOf} style={styles.message}>
                  <View style={styles.row}>
                    <Icon icon={Mail} size={16} tone={r.messageSeen ? 'muted' : 'link'} />
                    <Text variant="caption" tone="muted">
                      {weekRangeTitle(r.weekOf, names)}
                    </Text>
                  </View>
                  <Text variant="body">{r.message}</Text>
                </View>
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {reviews.length > 0 ? (
        <>
          <SectionDivider />
          <Section title={t('habitsTab.review.archiveTitle')}>
            <View>
              {reviews.slice(0, 8).map((review) => (
                <View key={review.weekOf} style={styles.review}>
                  <Text variant="heading">{t('practice.heart.reviews.weekOf', { date: weekRangeTitle(review.weekOf, names) })}</Text>
                  <HabitLines lines={reviewLines(review).map((l) => ({ ...l, title: titleOf(l.planId, l.title) }))} />
                  {review.step ? (
                    <Text variant="small" tone="muted">
                      {t('practice.heart.reviews.step', {
                        habit: titleOf(review.step.planId, ''),
                        choice: t(`practice.heart.weekly.${review.step.choice}`),
                      })}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </Section>
        </>
      ) : null}

      <HeartSheetView sheet={sheet} today={today} weekOf={weekOf} onClose={() => setSheet(null)} />
      <BottomSheet visible={pickingDay} title={t('habitsTab.review.pickDay')} onClose={() => setPickingDay(false)}>
        <Text variant="small" tone="muted">
          {t('habitsTab.review.pickDayHint')}
        </Text>
        <WeekdayPicker
          single
          value={[heart.prefs.reviewDay]}
          onChange={(days) => {
            const day = days[0];
            if (day === undefined) return;
            setHeart((h) => setHeartPrefs(h, { reviewDay: day, fridayReview: true }));
            setPickingDay(false);
            toast(t('habitsTab.review.daySaved', { day: t(`practice.weekdays.${day}`) }));
          }}
        />
      </BottomSheet>
    </View>
  );
}

/** One line of a review part with its action on the line («ابدأ», «ابدأ الآن»). */
function ReviewRow({ icon, title, action, onPress }: { icon: typeof Sun; title: string; action: string; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Icon icon={icon} size={20} tone="link" />
      <View style={styles.rowText}>
        <Text variant="body">{title}</Text>
      </View>
      <Button label={action} variant="outline" size="sm" onPress={onPress} />
    </View>
  );
}
