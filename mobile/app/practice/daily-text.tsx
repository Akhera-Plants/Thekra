/**
 * «نص اليوم» source (redesign §4.6; owner round 5, F-23 a), reached from the «⋯» of the home section «نص اليوم»: where
 * the day's text comes from, for that home section and the home-screen widget alike: a reminder set (shown by its
 * name), the saved texts, «تذكيراتي», or today's date and the coming occasion. The current choice is named at the top.
 * «تذكيراتي» is a choice here, never a second row (A-20 a); empty, it offers «اكتب أول تذكير». Sin-program content is
 * never a source.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import type { TodayTextSource } from '@thekra/practice-core';
import { useReminderSets } from '@/lib/api/reminder-sets';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { CheckRow, Notice, PageHeader, Screen, Section, SectionDivider, Skeleton, Text, TextLink, toast } from '@/ui';

const openMyReminders = () => router.push({ pathname: '/favorites', params: { tab: 'reminders' } });

export default function DailyTextScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const source = usePracticeStore((s) => s.prefs.todayText);
  const mine = usePracticeStore((s) => s.prefs.myReminders.length);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const sets = useReminderSets();
  const setTitle = (slug: string) => {
    const set = sets.data?.find((x) => x.slug === slug);
    return set ? (locale === 'en' ? set.titleEn || set.titleAr : set.titleAr) : null;
  };
  const sourceName = (s: TodayTextSource): string | null => {
    if (s.kind === 'set') return setTitle(s.slug);
    if (s.kind === 'mine') return t('dailyText.mine');
    if (s.kind === 'saved') return t('dailyText.saved');
    return t('dailyText.seasons');
  };
  const choose = (next: TodayTextSource) => {
    setPrefs((p) => ({ ...p, todayText: next }));
    const name = sourceName(next);
    if (name) toast(t('dailyText.chosenToast', { name }));
  };
  const is = (kind: TodayTextSource['kind'], slug?: string) => source.kind === kind && (slug === undefined || (source.kind === 'set' && source.slug === slug));
  const current = sourceName(source);

  return (
    <Screen edges={['bottom']}>
      <PageHeader title={t('dailyText.title')} lead={t('dailyText.lead')} />
      {current ? <Notice icon={Check}>{t('dailyText.current', { name: current })}</Notice> : null}

      {/* No published sets: no empty heading and no divider under it. */}
      {sets.isLoading || sets.isError || (sets.data?.length ?? 0) > 0 ? (
        <>
          <Section title={t('dailyText.sets')} lead={t('dailyText.setsLead')}>
            {sets.isLoading ? (
              <>
                <Skeleton height={56} />
                <Skeleton height={56} />
              </>
            ) : null}
            {sets.isError ? (
              <Text variant="small" tone="muted">
                {t('dailyText.setsOffline')}
              </Text>
            ) : null}
            {(sets.data ?? []).map((set) => (
              <CheckRow
                key={set.slug}
                radio
                title={locale === 'en' ? set.titleEn || set.titleAr : set.titleAr}
                checked={is('set', set.slug)}
                onPress={() => choose({ kind: 'set', slug: set.slug })}
              />
            ))}
          </Section>
          <SectionDivider />
        </>
      ) : null}

      <Section title={t('dailyText.yours')}>
        <CheckRow
          radio
          title={t('dailyText.mine')}
          hint={mine === 0 ? t('dailyText.mineEmpty') : t('dailyText.mineCount', { count: mine })}
          checked={is('mine')}
          onPress={() => choose({ kind: 'mine' })}
        >
          {/* An empty choice gets its way to fill it (A-25). */}
          {mine === 0 ? <TextLink label={t('dailyText.writeFirst')} onPress={openMyReminders} /> : null}
        </CheckRow>
        <CheckRow
          radio
          title={t('dailyText.saved')}
          hint={signedIn ? undefined : t('dailyText.savedSignIn')}
          checked={is('saved')}
          onPress={() => choose({ kind: 'saved' })}
        />
        <CheckRow radio title={t('dailyText.seasons')} checked={is('seasons')} onPress={() => choose({ kind: 'seasons' })} />
      </Section>
    </Screen>
  );
}
