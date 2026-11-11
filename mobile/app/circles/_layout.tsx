/**
 * Stack for «صحبة»: the list, start a circle, «لديّ دعوة» (also the `thekra://circles/invite/<code>` link behind the
 * website's invite page), a circle and my settings in it. Inviting is a sheet on the circle's page. The native header
 * shows only Back; each screen shows its own title.
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
      <Stack.Screen name="redeem" options={{ title: t('circles.invites.redeemTitle') }} />
      <Stack.Screen name="invite/[code]" options={{ title: t('circles.invites.redeemTitle') }} />
      <Stack.Screen name="[id]/index" options={{ title: t('circles.title') }} />
      <Stack.Screen name="[id]/settings" options={{ title: t('circles.settingsTitle') }} />
    </Stack>
  );
}
