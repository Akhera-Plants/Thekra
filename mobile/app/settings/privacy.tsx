/** Settings ← «الخصوصية والتشفير»: the «تخفَّف» lock, the encrypted saving of every «تخفَّف» program, export, the offline copy. */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PrivacySection } from '@/components/settings/SettingsSections';
import { PageHeader, Screen } from '@/ui';

export default function PrivacySettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen edges={['bottom']} keyboard>
      <Stack.Screen options={{ title: t('settings.groups.privacy') }} />
      <PageHeader title={t('settings.groups.privacy')} />
      <PrivacySection />
    </Screen>
  );
}
