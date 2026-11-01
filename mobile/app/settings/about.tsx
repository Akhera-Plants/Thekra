/** Settings ← «عن التطبيق»: the site's about and privacy pages, and the version. */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AboutSection } from '@/components/settings/SettingsSections';
import { PageHeader, Screen } from '@/ui';

export default function AboutSettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('settings.about') }} />
      <PageHeader title={t('settings.about')} />
      <AboutSection />
    </Screen>
  );
}
