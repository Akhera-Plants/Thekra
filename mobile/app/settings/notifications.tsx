/**
 * Settings ← «التنبيهات والتذكير»: every reminder switch and time on this device in titled groups, with «المحاسبة»
 * (members only, like the practice they remind of).
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { NotificationsSection } from '@/components/settings/SettingsSections';
import { PageHeader, Screen } from '@/ui';

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const signedIn = useRequireSignIn('/settings/notifications');
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('settings.groups.notifications') }} />
      <PageHeader title={t('settings.groups.notifications')} />
      {signedIn ? (
        <NotificationsSection />
      ) : null}
    </Screen>
  );
}
