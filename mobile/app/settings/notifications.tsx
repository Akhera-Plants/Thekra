/**
 * Settings ← «التنبيهات» (owner round 5, F-29): every reminder channel on this device in groups (NotificationsSettings),
 * members only, like the practice they remind of.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';
import { PageHeader, Screen } from '@/ui';

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const signedIn = useRequireSignIn('/settings/notifications');
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('settings.groups.notifications') }} />
      <PageHeader title={t('settings.groups.notifications')} lead={t('notifications.lead')} />
      {signedIn ? <NotificationsSettings /> : null}
    </Screen>
  );
}
