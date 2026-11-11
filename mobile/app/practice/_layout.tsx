/**
 * Stack for the practice screens: add habit, the habit page, «صلة الرحم والأحباب» (kinship: one periodic act's people),
 * «عمل من عندك» (periodic-custom), «قضاء الفوائت» (qada), «رسائلي إلى نفسي» (self-messages), «تخفَّف», «لحظة مجاهدة»,
 * «استراتيجيات العادات», «أوقات الصلاة», «نص اليوم» and the onboarding. The routes of removed screens (calendar,
 * pledges, reviews, duties, loops, habits, periodic) are plain redirects into «عاداتي» (owner round 5, §1 IA).
 * The native header shows only Back; each screen shows its own title. The `title` options below name the screens for
 * accessibility and the Android task switcher; they stay generic on purpose (the sin-program screen never names the
 * sin in a title).
 */

import React from 'react';
import { Stack, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { useStackScreenOptions } from '@/ui';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/RouteErrorBoundary';

export default function PracticeLayout() {
  const { t } = useTranslation();
  const options = useStackScreenOptions();
  // Members only (owner, 2026-11-01): a guest who reaches a practice screen by a link or a notification signs in first.
  // The sign-in keeps the screen the guest asked for («لحظة مجاهدة», «تخفَّف»…), not always «عاداتي» (owner round 8, item 1).
  const pathname = usePathname();
  const signedIn = useRequireSignIn(pathname.startsWith('/practice/') ? pathname : '/habits');
  if (!signedIn) return null;
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="add" options={{ title: t('practice.add.title') }} />
      <Stack.Screen name="onboarding" options={{ title: t('onboarding.title'), headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="plan/[id]" options={{ title: t('practice.title') }} />
      <Stack.Screen name="kinship" options={{ title: t('habitsHub.periodic.silat') }} />
      <Stack.Screen name="periodic-custom" options={{ title: t('habitsHub.periodic.custom') }} />
      <Stack.Screen name="qada" options={{ title: t('habitsHub.qada.title') }} />
      <Stack.Screen name="self-messages" options={{ title: t('habitsHub.messages.title') }} />
      <Stack.Screen name="sin-program" options={{ title: t('sinProgram.title') }} />
      <Stack.Screen name="moment" options={{ title: t('sinProgram.moment.title') }} />
      <Stack.Screen name="strategies" options={{ title: t('practice.strategies.title') }} />
      {/* A redirect to «المحفوظات» ← «تذكيراتي», kept for older links. */}
      <Stack.Screen name="my-reminders" options={{ title: t('myReminders.title') }} />
      <Stack.Screen name="prayer-times" options={{ title: t('prayerTimes.title') }} />
      <Stack.Screen name="daily-text" options={{ title: t('dailyText.title') }} />
    </Stack>
  );
}
