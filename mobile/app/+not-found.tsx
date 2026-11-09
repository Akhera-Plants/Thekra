/**
 * Unknown route (owner round 6, C-22: the reference's component): the title «الصفحة غير موجودة», one calm line, and ONE
 * button «العودة إلى الرئيسية». The native stack header above it owns Back.
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { space } from '@/theme';
import { Button, Screen, Text } from '@/ui';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen edges={['bottom']} scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: space.lg, paddingVertical: space['3xl'] }}>
        <Text variant="display" align="center" accessibilityRole="header">
          {t('common.notFound')}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {t('common.notFoundBody')}
        </Text>
        <Button label={t('common.backHome')} size="lg" onPress={() => router.navigate('/')} />
      </View>
    </Screen>
  );
}
