/** Settings ← «اللغة والمظهر»: theme, language (a direction change reloads the app at once) and the Hijri date. */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppearanceSection } from '@/components/settings/SettingsSections';
import { PageHeader, Screen } from '@/ui';

export default function AppearanceSettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('settings.groups.appearance') }} />
      <PageHeader title={t('settings.groups.appearance')} />
      <AppearanceSection />
    </Screen>
  );
}
