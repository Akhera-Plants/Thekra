/** Unknown route: a calm note and the way home. The native stack header above it owns Back. */

import React from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react-native';
import { EmptyState, Screen } from '@/ui';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <EmptyState
        icon={Compass}
        message={t('common.notFound')}
        actionLabel={t('tabs.home')}
        onAction={() => router.navigate('/')}
      />
    </Screen>
  );
}
