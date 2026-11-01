/** Settings ← «الحساب». */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { PageHeader, Screen } from '@/ui';

export default function AccountSettingsScreen() {
  const { t } = useTranslation();
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('settings.groups.account') }} />
      <PageHeader title={t('settings.groups.account')} />
      <AccountSettings />
    </Screen>
  );
}
