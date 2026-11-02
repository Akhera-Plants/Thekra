/**
 * «مواسم الخير» (the occasions calendar, roadmap §2.2; owner round 3, decision 4), after the website's calendar page:
 * today in Hijri in a next-step note with an icon that opens the ±2 day Hijri adjustment in a sheet, then two tabs:
 * «المناسبات القادمة» («أضفها إلى تقويمك»: «اشترك في التقويم», the public feed, no personal data, no account; `webcal://`
 * on iOS, Google Calendar's add-by-URL page on Android; and «نزّل ملف التقويم», the same `.ics` over https; then the
 * upcoming occasions as a hairline list, each opening its good deed) and «الشهر» (the month grid with the sunnah
 * occasions marked, the selected day's occasions under it).
 * The Hijri date is hidden when the runtime lacks Umm al-Qura (`isHijriSupported()` is false on a Hermes build with
 * reduced ICU).
 */

import React, { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalendarCog, CalendarDays, CalendarPlus, Download } from 'lucide-react-native';
import { BottomSheet } from '@/components/practice/mujahada/Sheet';
import { addDays, formatHijriAr, isHijriSupported, toHijri, updateSettings, weekday } from '@thekra/practice-core';
import { calendarFeedUrl, useCalendarOccasions } from '@/lib/api/practice';
import { pick, type CalendarOccasionDto } from '@/lib/practice/catalog-types';
import { calendarSubscribeLink, firstWeekday, monthEnd, monthStart, shortDayTitle } from '@/lib/practice/calendar-grid';
import { shortDate } from '@/lib/practice/format';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { useDateNames, useHubDays } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { MonthGrid } from '@/components/practice/hub/MonthGrid';
import { space, useStyles, useTheme, type Theme } from '@/theme';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ErrorText,
  ForwardArrow,
  Icon,
  IconButton,
  NextStep,
  SegmentTabs,
  Ornament,
  PageHeader,
  Screen,
  Section,
  Skeleton,
  Text,
  Wrap,
} from '@/ui';

const HORIZON_DAYS = 90;
const OFFSETS = [-2, -1, 0, 1, 2];
const SKELETON_ROWS = ['a', 'b', 'c'];

type HijriParts = CalendarOccasionDto['hijri'];

const makeStyles = (t: Theme) => ({
  group: { gap: space.sm },
  today: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  month: { gap: space.lg },
  list: { borderTopWidth: 1, borderTopColor: t.colors.border },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: space.md,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    minHeight: 64,
  },
  rowPressed: { backgroundColor: t.colors.accent },
  rowIcon: { marginTop: 5 },
  rowText: { flex: 1, gap: 2 },
  rowArrow: { marginTop: 7 },
  skeletonRow: { gap: space.sm, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: t.colors.border },
});

/** «+1» stays «+1» inside Arabic text (an LTR isolate keeps the sign before the digit). */
function signed(n: number): string {
  return n > 0 ? `⁦+${n}⁩` : n < 0 ? `⁦${n}⁩` : '0';
}

export default function CalendarScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const setStore = usePracticeStore((s) => s.setStore);
  const [openFailed, setOpenFailed] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'month'>('upcoming');
  const [adjusting, setAdjusting] = useState(false);
  const d = today();
  const occasions = useCalendarOccasions(d, addDays(d, HORIZON_DAYS), hijriOffset, locale);
  const hijri = isHijriSupported();
  const { today: todayDate, selected, month, select, shiftMonth } = useHubDays();

  const hijriLabel = (h: HijriParts) => `${h.day} ${t(`calendar.hijriMonths.${h.month}`)} ${h.year} ${t('calendar.hijriSuffix')}`;

  let todayHijri: string | null = null;
  if (hijri) {
    try {
      todayHijri = locale === 'ar' ? formatHijriAr(d, hijriOffset) : hijriLabel(toHijri(d, hijriOffset));
    } catch {
      todayHijri = null;
    }
  }

  async function openCalendarLink(url: string) {
    setOpenFailed(false);
    try {
      await Linking.openURL(url);
    } catch {
      setOpenFailed(true);
    }
  }

  const handleSubscribe = () => void openCalendarLink(calendarSubscribeLink(calendarFeedUrl(locale), Platform.OS));
  const handleDownload = () => void openCalendarLink(calendarFeedUrl(locale));

  const rows = occasions.data ?? [];

  return (
    <Screen edges={['bottom']} refreshing={occasions.isRefetching} onRefresh={() => void occasions.refetch()}>
      <PageHeader title={t('calendar.title')} />

      <View style={styles.today}>
        <View style={{ flex: 1 }}>
          <NextStep title={`${t(`practice.weekdays.${weekday(d)}`)} ${shortDate(d)}`}>
            {todayHijri ? (
              <Text variant="heading" tone="link">
                {t('calendar.todayHijri', { date: todayHijri })}
              </Text>
            ) : null}
          </NextStep>
        </View>
        {hijri ? <IconButton icon={CalendarCog} label={t('calendar.offset')} onPress={() => setAdjusting(true)} bordered /> : null}
      </View>

      <SegmentTabs
        items={[
          { key: 'upcoming', label: t('calendar.tabUpcoming') },
          { key: 'month', label: t('calendar.tabMonth') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'month' ? (
        <MonthOccasions
          month={month}
          today={todayDate}
          selected={selected}
          hijriLabel={hijri ? hijriLabel : null}
          onSelect={select}
          onShiftMonth={shiftMonth}
        />
      ) : (
        <>
          <Section title={t('calendar.addToCalendar')}>
            <View style={styles.group}>
              <Button label={t('calendar.subscribe')} icon={CalendarPlus} onPress={handleSubscribe} block />
              <Button label={t('calendar.download')} icon={Download} variant="outline" onPress={handleDownload} block />
              {openFailed ? <ErrorText>{t('calendar.openFailed')}</ErrorText> : null}
              <Text variant="small" tone="muted">
                {t('calendar.subscribeHint')}
              </Text>
            </View>
          </Section>

          <Ornament />

          <Section title={t('calendar.upcoming')}>
            {occasions.isLoading ? (
              <OccasionsSkeleton />
            ) : occasions.isError ? (
              <ErrorState onRetry={() => void occasions.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState icon={CalendarDays} message={t('calendar.empty')} />
            ) : (
              <View style={styles.list}>
                {rows.map((o) => (
                  <OccasionRow key={`${o.key}-${o.date}`} occasion={o} hijriLabel={hijri ? hijriLabel : null} />
                ))}
              </View>
            )}
          </Section>
        </>
      )}

      <BottomSheet visible={adjusting} title={t('calendar.offset')} onClose={() => setAdjusting(false)}>
        <Wrap>
          {OFFSETS.map((v) => (
            <Chip key={v} label={signed(v)} selected={hijriOffset === v} onPress={() => setStore((s) => updateSettings(s, { hijriOffset: v }))} />
          ))}
        </Wrap>
        <Text variant="small" tone="muted">
          {t('calendar.offsetHint')}
        </Text>
        {todayHijri ? (
          <Text variant="body" tone="link">
            {t('calendar.todayHijri', { date: todayHijri })}
          </Text>
        ) : null}
        <Button label={t('common.done')} onPress={() => setAdjusting(false)} block />
      </BottomSheet>
    </Screen>
  );
}

interface MonthOccasionsProps {
  month: string;
  today: string;
  selected: string;
  hijriLabel: ((h: HijriParts) => string) | null;
  onSelect: (date: string) => void;
  onShiftMonth: (delta: number) => void;
}

/** The month grid with its occasions marked, and the selected day's occasions under it. */
function MonthOccasions({ month, today: todayDate, selected, hijriLabel, onSelect, onShiftMonth }: MonthOccasionsProps) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const names = useDateNames();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const occasions = useCalendarOccasions(monthStart(month), monthEnd(month), hijriOffset, locale);
  const rows = occasions.data;
  const marked = useMemo(() => new Set((rows ?? []).map((o) => o.date)), [rows]);
  const dayRows = useMemo(() => (rows ?? []).filter((o) => o.date === selected), [rows, selected]);
  const inMonth = selected >= monthStart(month) && selected <= monthEnd(month);

  return (
    <View style={styles.month}>
      <MonthGrid
        month={month}
        first={firstWeekday(locale)}
        today={todayDate}
        selected={selected}
        occasions={marked}
        onSelect={onSelect}
        onShiftMonth={onShiftMonth}
      />
      {inMonth ? (
        <Section title={t('calendar.dayTitle', { date: shortDayTitle(selected, names) })}>
          {occasions.isLoading ? (
            <OccasionsSkeleton />
          ) : occasions.isError ? (
            <ErrorState onRetry={() => void occasions.refetch()} />
          ) : dayRows.length === 0 ? (
            <Text variant="small" tone="muted">
              {t('calendar.dayEmpty')}
            </Text>
          ) : (
            <View style={styles.list}>
              {dayRows.map((o) => (
                <OccasionRow key={`${o.key}-${o.date}`} occasion={o} hijriLabel={hijriLabel} />
              ))}
            </View>
          )}
        </Section>
      ) : null}
    </View>
  );
}

interface OccasionRowProps {
  occasion: CalendarOccasionDto;
  hijriLabel: ((h: HijriParts) => string) | null;
}

function OccasionRow({ occasion, hijriLabel }: OccasionRowProps) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const title = pick(occasion, 'title', locale);
  const when = `${t(`practice.weekdays.${weekday(occasion.date)}`)} ${shortDate(occasion.date)}`;
  const hijriText = hijriLabel && occasion.hijri ? hijriLabel(occasion.hijri) : null;
  return (
    <Pressable
      onPress={() => router.push(`/good-deeds/${occasion.deed}`)}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="link"
      accessibilityLabel={hijriText ? `${title}. ${when}. ${hijriText}` : `${title}. ${when}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <Icon icon={CalendarDays} size={20} tone="link" />
      </View>
      <View style={styles.rowText}>
        <Text variant="body" weight="medium">
          {title}
        </Text>
        <Text variant="small" tone="muted">
          {hijriText ? `${when} · ${hijriText}` : when}
        </Text>
        {occasion.basis === 'organizational' ? (
          <Text variant="caption" tone="muted">
            {t('practice.basis.organizational')}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowArrow}>
        <ForwardArrow size={17} tone="muted" />
      </View>
    </Pressable>
  );
}

function OccasionsSkeleton() {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.list} accessibilityLabel={t('common.loading')}>
      {SKELETON_ROWS.map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={12} />
        </View>
      ))}
    </View>
  );
}
