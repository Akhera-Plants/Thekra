/**
 * The week strip at the top of «اليوم» (owner round 6, C-01r / C-02a; the reference's calendar row, our type and
 * colours): seven days from the member's review day (Friday by default: the weekly review and the next week's plan),
 * «الأسبوع السابق» / «الأسبوع التالي» at the ends. Under each number one calm mark from practice-core `weekStrip`: a
 * filled dot (kept), a ring (part kept), the words «لم تتم» (muted, never red), «عذر», or nothing. Today sits on a soft
 * tint. A past day opens its details and asks (`onOpenDay`); today is the page itself; future days are view-only.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { addDays, weekday as weekdayOf, weekStart, weekStrip, type LocalDate, type WeekStripDay } from '@thekra/practice-core';
import { STRIP_WEEKS_BACK, stripDayOpens, stripMark } from '@/lib/practice/hub-view';
import { usePracticeCatalog } from '@/lib/api/practice';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { habitFor } from '@/lib/practice/reminders';
import { useDateNames, usePlanDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Icon, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  root: { flexDirection: 'row' as const, alignItems: 'stretch' as const, gap: 2 },
  arrow: { width: 32, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: radius.control },
  arrowPressed: { backgroundColor: t.colors.accent },
  days: { flex: 1, flexDirection: 'row' as const, gap: 2 },
  day: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center' as const,
    gap: 2,
    paddingVertical: space.xs,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 76,
  },
  dayToday: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.border },
  dayPressed: { backgroundColor: t.colors.accent },
  number: { fontVariant: ['tabular-nums' as const] },
  markBox: { height: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});

export function WeekStrip({ today, onOpenDay }: { today: LocalDate; onOpenDay: (date: LocalDate) => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const names = useDateNames();
  const locale = useUiLocale();
  const store = usePracticeStore((s) => s.store);
  const reviewDay = usePracticeStore((s) => s.heart.prefs.reviewDay);
  const habits = usePracticeCatalog(locale).data?.habits;
  const planDays = usePlanDays();
  const [offset, setOffset] = useState(0);
  const anchor = addDays(weekStart(today, reviewDay), offset * 7);
  const days = useMemo(
    () => weekStrip(store, anchor, today, { ...planDays, reviewDay, isPeriodicAct: (p) => habitFor(p, habits ?? [])?.kind === 'periodic' }),
    [store, anchor, today, planDays, reviewDay, habits],
  );
  const canBack = offset > -STRIP_WEEKS_BACK;
  const canForward = offset < 1;
  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => canBack && setOffset((o) => o - 1)}
        disabled={!canBack}
        accessibilityRole="button"
        accessibilityLabel={t('habitsHub.week.previous')}
        style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed, !canBack && { opacity: 0.35 }]}
      >
        <Icon icon={locale === 'ar' ? ChevronRight : ChevronLeft} size={20} tone="muted" />
      </Pressable>
      <View style={styles.days}>
        {days.map((day) => (
          <StripDay key={day.date} day={day} today={today} weekday={names.weekday(weekdayOf(day.date))} onOpen={onOpenDay} dotColor={colors.primary} />
        ))}
      </View>
      <Pressable
        onPress={() => canForward && setOffset((o) => o + 1)}
        disabled={!canForward}
        accessibilityRole="button"
        accessibilityLabel={t('habitsHub.week.next')}
        style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed, !canForward && { opacity: 0.35 }]}
      >
        <Icon icon={locale === 'ar' ? ChevronLeft : ChevronRight} size={20} tone="muted" />
      </Pressable>
    </View>
  );
}

function StripDay({ day, today, weekday, onOpen, dotColor }: { day: WeekStripDay; today: LocalDate; weekday: string; onOpen: (d: LocalDate) => void; dotColor: string }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const mark = stripMark(day.status);
  const opens = stripDayOpens(day.date, today);
  const future = day.date > today;
  const number = String(Number(day.date.slice(8)));
  const markWords =
    mark === 'done'
      ? t('habitsHub.week.done')
      : mark === 'partial'
        ? t('habitsHub.week.partial')
        : mark === 'notDone'
          ? t('habitsHub.week.notDone')
          : mark === 'excused'
            ? t('habitsHub.week.excused')
            : future
              ? t('habitsHub.week.future')
              : '';
  return (
    <Pressable
      onPress={() => opens && onOpen(day.date)}
      disabled={!opens}
      accessibilityRole={opens ? 'button' : 'text'}
      accessibilityLabel={[weekday, number, day.isToday ? t('practice.today') : '', markWords].filter(Boolean).join('، ')}
      accessibilityState={{ selected: day.isToday, disabled: !opens }}
      style={({ pressed }) => [styles.day, day.isToday && styles.dayToday, pressed && opens && styles.dayPressed]}
    >
      <Text variant="caption" tone="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {shortWeekday(weekday)}
      </Text>
      <Text variant="heading" tone={future ? 'muted' : 'default'} style={styles.number}>
        {number}
      </Text>
      <View style={styles.markBox}>
        {mark === 'done' ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
        {mark === 'partial' ? <View style={[styles.dot, { borderWidth: 1.5, borderColor: dotColor }]} /> : null}
        {mark === 'notDone' || mark === 'excused' ? (
          <Text variant="caption" tone="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {markWords}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Short weekday names for the narrow columns: Arabic drops the article («الأربعاء» → «أربعاء»), English «Wednesday» → «Wed». */
function shortWeekday(name: string): string {
  return /^[A-Za-z]/.test(name) ? name.slice(0, 3) : name.replace(/^ال/, '');
}
