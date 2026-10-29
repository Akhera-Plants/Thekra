/**
 * Stack for the practice screens: «طاعاتي», add habit, plan, «فروضي وأدواري», صلة الرحم, ترك المعصية, التقويم.
 * The native header shows only Back; each screen shows its own title. The `title` options below name the
 * screens for accessibility and the Android task switcher; they stay generic on purpose (the sin-program screen
 * never names the sin in a title).
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/ui';

export default function PracticeLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="habits" options={{ title: t('practice.hub.habitsTrack') }} />
      <Stack.Screen name="add" options={{ title: t('practice.add.title') }} />
      <Stack.Screen name="plan/[id]" options={{ title: t('practice.title') }} />
      <Stack.Screen name="duties" options={{ title: t('practice.duties.title') }} />
      <Stack.Screen name="kinship" options={{ title: t('kinship.title') }} />
      <Stack.Screen name="sin-program" options={{ title: t('sinProgram.title') }} />
      <Stack.Screen name="calendar" options={{ title: t('calendar.title') }} />
    </Stack>
  );
}
