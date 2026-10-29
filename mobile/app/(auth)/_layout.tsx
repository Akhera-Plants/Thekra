/**
 * The optional account screens, presented as a modal (root layout). The native header carries no title (each
 * screen shows its own, as on the website) and a close button at the end; login and register replace each other,
 * so closing always dismisses the whole modal.
 */

import React from 'react';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { IconButton, useStackScreenOptions } from '@/ui';

function CloseButton() {
  const { t } = useTranslation();
  return <IconButton icon={X} label={t('common.close')} onPress={() => router.back()} tone="default" />;
}

export default function AuthLayout() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={{ ...stackOptions, headerRight: () => <CloseButton /> }}>
      <Stack.Screen name="login" options={{ title: t('auth.loginTitle') }} />
      <Stack.Screen name="register" options={{ title: t('auth.registerTitle') }} />
    </Stack>
  );
}
