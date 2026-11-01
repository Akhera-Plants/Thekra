/**
 * Settings ← «التنبيهات والتذكير»: every reminder switch and time on this device, then «نية اليوم والمحاسبة» (members
 * only, like the practice they remind of).
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRequireSignIn } from '@/lib/auth/require-sign-in';
import { HeartSection, NotificationsSection } from '@/components/settings/SettingsSections';
import { PageHeader, Screen } from '@/ui';

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const signedIn = useRequireSignIn('/settings/notifications');
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t('settings.groups.notifications') }} />
      <PageHeader title={t('settings.groups.notifications')} />
      {signedIn ? (
        <>
          <NotificationsSection />
          <HeartSection />
        </>
      ) : null}
    </Screen>
  );
}
