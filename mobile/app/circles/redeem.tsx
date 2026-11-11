/**
 * «لديّ دعوة» (owner round 8, Q6): the one entry for an invitation, from the صحبة list. `?code=` fills the code in.
 * The link a friend opens (`thekra://circles/invite/<code>`, from the website's invite page) lands in the same
 * screen (`invite/[code].tsx`). Signed out, the code stays in the route while the person signs in.
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CircleListSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import { RedeemInvite } from '@/components/circles/RedeemInvite';
import { useCircleAccess, useCircleUserId } from '@/lib/api/circles';
import { PageHeader, Screen } from '@/ui';

export default function RedeemScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const userId = useCircleUserId();
  const access = useCircleAccess();
  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={t('circles.invites.redeemTitle')} />
      {!userId ? <CirclesSignedOut /> : access.isPending ? <CircleListSkeleton /> : <RedeemInvite initialCode={typeof code === 'string' ? code : ''} />}
    </Screen>
  );
}
