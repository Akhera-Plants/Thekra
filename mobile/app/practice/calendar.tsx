/**
 * Calendar (roadmap §2.2): upcoming sunnah occasions from `GET /v1/calendar/occasions`, today's Hijri date
 * (practice-core `formatHijriAr`, hidden when the runtime lacks Umm al-Qura: `isHijriSupported()` is false on a
 * Hermes build with reduced ICU), the user's ±2 day Hijri offset, and «اشترك في التقويم» which opens the public
 * `webcal://` feed (no personal data, no account).
 */

import React from 'react';
import { Alert, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addDays, formatHijriAr, isHijriSupported, toHijri, updateSettings, weekday } from '@thekra/practice-core';
import { calendarSubscribeUrl, useCalendarOccasions } from '@/lib/api/practice';
import { pick, type CalendarOccasionDto } from '@/lib/practice/catalog-types';
import { shortDate } from '@/lib/practice/format';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { ErrorState } from '@/components/ErrorState';
import { Body, Button, Card, Chip, Loading, Screen, SectionTitle, Wrap } from '@/components/practice/ui';

const HORIZON_DAYS = 90;

export default function CalendarScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const hijriOffset = usePracticeStore((s) => s.store.settings.hijriOffset);
  const setStore = usePracticeStore((s) => s.setStore);
  const d = today();
  const occasions = useCalendarOccasions(d, addDays(d, HORIZON_DAYS), hijriOffset, locale);
  const hijri = isHijriSupported();

  const hijriLabel = (h: { year: number; month: number; day: number }) =>
    `${h.day} ${t(`calendar.hijriMonths.${h.month}`)} ${h.year} ${t('calendar.hijriSuffix')}`;

  let todayHijri: string | null = null;
  if (hijri) {
    try {
      todayHijri = locale === 'ar' ? formatHijriAr(d, hijriOffset) : hijriLabel(toHijri(d, hijriOffset));
    } catch {
      todayHijri = null;
    }
  }

  async function subscribe() {
    try {
      await Linking.openURL(calendarSubscribeUrl(locale));
    } catch {
      Alert.alert(t('calendar.openFailed'));
    }
  }

  return (
    <Screen>
      {todayHijri ? <SectionTitle>{t('calendar.todayHijri', { date: todayHijri })}</SectionTitle> : null}

      {hijri ? (
        <Card>
          <Body>{t('calendar.offset')}</Body>
          <Body muted small>
            {t('calendar.offsetHint')}
          </Body>
          <Wrap>
            {[-2, -1, 0, 1, 2].map((v) => (
              <Chip
                key={v}
                label={v > 0 ? `+${v}` : String(v)}
                selected={hijriOffset === v}
                onPress={() => setStore((s) => updateSettings(s, { hijriOffset: v }))}
              />
            ))}
          </Wrap>
        </Card>
      ) : null}

      <Card tone="info">
        <Button label={t('calendar.subscribe')} onPress={() => void subscribe()} />
        <Body muted small>
          {t('calendar.subscribeHint')}
        </Body>
      </Card>

      <SectionTitle>{t('calendar.upcoming')}</SectionTitle>
      {occasions.isLoading ? (
        <Loading />
      ) : occasions.isError ? (
        <ErrorState onRetry={() => void occasions.refetch()} />
      ) : (occasions.data ?? []).length === 0 ? (
        <Body muted>{t('calendar.empty')}</Body>
      ) : (
        (occasions.data ?? []).map((o) => <OccasionCard key={`${o.key}-${o.date}`} occasion={o} hijriLabel={hijri ? hijriLabel : null} />)
      )}
    </Screen>
  );
}

function OccasionCard({
  occasion,
  hijriLabel,
}: {
  occasion: CalendarOccasionDto;
  hijriLabel: ((h: CalendarOccasionDto['hijri']) => string) | null;
}) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  return (
    <Card>
      <Body>{pick(occasion, 'title', locale)}</Body>
      <Body muted small>
        {t(`practice.weekdays.${weekday(occasion.date)}`)} {shortDate(occasion.date)}
        {hijriLabel && occasion.hijri ? ` · ${hijriLabel(occasion.hijri)}` : ''}
      </Body>
      <Body muted small>
        {t(`practice.basis.${occasion.basis}`)}
      </Body>
    </Card>
  );
}
