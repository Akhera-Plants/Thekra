/**
 * Stack for «صحبة»: the list, start a circle, join with a code (also the `thekra://circles/join?code=` link), my
 * invites, a personal invite (`thekra://circles/invite/<code>`, round 6), a circle and my settings in it. The native header shows only Back; each screen shows its own title.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStackScreenOptions } from '@/ui';

export default function CirclesLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      <Stack.Screen name="index" options={{ title: t('circles.title') }} />
      <Stack.Screen name="create" options={{ title: t('circles.createTitle') }} />
      <Stack.Screen name="join" options={{ title: t('circles.joinTitle') }} />
      <Stack.Screen name="invites" options={{ title: t('circles.invites.title') }} />
      <Stack.Screen name="invite/[code]" options={{ title: t('circles.invites.redeemTitle') }} />
      <Stack.Screen name="[id]/index" options={{ title: t('circles.title') }} />
      <Stack.Screen name="[id]/settings" options={{ title: t('circles.settingsTitle') }} />
    </Stack>
  );
}
