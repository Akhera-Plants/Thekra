/**
 * Stack for the practice screens: add habit, plan, «فروضي وأدواري», صلة الرحم, ترك المعصية, التقويم.
 * Header titles are generic on purpose (the sin-program screen never names the sin in a title).
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/lib/tokens';

export default function PracticeLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: Colors.primary,
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.text },
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="add" options={{ title: t('practice.add.title') }} />
      <Stack.Screen name="plan/[id]" options={{ title: t('practice.title') }} />
      <Stack.Screen name="duties" options={{ title: t('practice.duties.title') }} />
      <Stack.Screen name="kinship" options={{ title: t('kinship.title') }} />
      <Stack.Screen name="sin-program" options={{ title: t('sinProgram.title') }} />
      <Stack.Screen name="calendar" options={{ title: t('calendar.title') }} />
    </Stack>
  );
}
