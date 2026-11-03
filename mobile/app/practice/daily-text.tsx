/**
 * «نص اليوم» (redesign §4.6): where the home-screen widget's daily text comes from: a reminder set, the saved texts,
 * «تذكيراتي», or «مواسم الخير» (today's date and the next occasion). Sin-program content is never a source.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TodayTextSource } from '@thekra/practice-core';
import { router } from 'expo-router';
import { useReminderSets } from '@/lib/api/reminder-sets';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { useAuthStore } from '@/lib/stores/auth-store';
import { CheckRow, ListRow, PageHeader, Rule, Screen, Section, Text } from '@/ui';

export default function DailyTextScreen() {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const source = usePracticeStore((s) => s.prefs.todayText);
  const mine = usePracticeStore((s) => s.prefs.myReminders.length);
  const setPrefs = usePracticeStore((s) => s.setPrefs);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const sets = useReminderSets();
  const choose = (next: TodayTextSource) => setPrefs((p) => ({ ...p, todayText: next }));
  const is = (kind: TodayTextSource['kind'], slug?: string) => source.kind === kind && (slug === undefined || (source.kind === 'set' && source.slug === slug));

  return (
    <Screen edges={['bottom']}>
      <PageHeader title={t('dailyText.title')} lead={t('dailyText.lead')} />
      <Section>
        <CheckRow radio title={t('dailyText.seasons')} checked={is('seasons')} onPress={() => choose({ kind: 'seasons' })} />
        <CheckRow
          radio
          title={t('dailyText.mine')}
          hint={mine === 0 ? t('dailyText.mineEmpty') : undefined}
          checked={is('mine')}
          onPress={() => choose({ kind: 'mine' })}
        />
        <CheckRow
          radio
          title={t('dailyText.saved')}
          hint={signedIn ? undefined : t('dailyText.savedSignIn')}
          checked={is('saved')}
          onPress={() => choose({ kind: 'saved' })}
        />
      </Section>
      <Rule />
      <Section title={t('dailyText.sets')}>
        {sets.isError ? (
          <Text variant="small" tone="muted">
            {t('dailyText.setsOffline')}
          </Text>
        ) : null}
        {(sets.data ?? []).map((set) => (
          <CheckRow
            key={set.slug}
            radio
            title={locale === 'en' ? set.titleEn : set.titleAr}
            checked={is('set', set.slug)}
            onPress={() => choose({ kind: 'set', slug: set.slug })}
          />
        ))}
      </Section>
      <Section>
        <ListRow title={t('myReminders.title')} chevron onPress={() => router.push({ pathname: '/favorites', params: { part: 'mine' } })} />
      </Section>
    </Screen>
  );
}
