/**
 * The «رفقة» screens' shared states: signed out (circles need an account), and skeletons in the shape of the list
 * and of a circle while they load.
 */

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react-native';
import { space } from '@/theme';
import { EmptyState, Skeleton } from '@/ui';

const openLogin = () => router.push('/(auth)/login');

export function CirclesSignedOut() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Users}
      message={t('circles.signInPrompt')}
      hint={t('circles.signInHint')}
      actionLabel={t('auth.loginButton')}
      onAction={openLogin}
    />
  );
}

const ROWS = ['a', 'b', 'c'] as const;

export function CircleListSkeleton() {
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t('common.loading')} style={{ gap: space.xl }}>
      {ROWS.map((key) => (
        <View key={key} style={{ gap: space.sm }}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="35%" height={12} />
        </View>
      ))}
    </View>
  );
}

export function CircleDetailSkeleton() {
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t('common.loading')} style={{ gap: space['2xl'] }}>
      <View style={{ gap: space.sm }}>
        <Skeleton width="60%" height={30} />
        <Skeleton width="80%" height={14} />
      </View>
      {ROWS.map((key) => (
        <View key={key} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Skeleton width={90} height={14} />
          <View style={{ flex: 1 }}>
            <Skeleton height={10} round />
          </View>
        </View>
      ))}
    </View>
  );
}
