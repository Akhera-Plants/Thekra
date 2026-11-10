/**
 * `thekra://circles/invite/<code>` (round 6, C-01k): a personal صحبة invite opens «أدخل رمز الدعوة» with the code filled
 * in; signed out, the code stays in the route while the user signs in. A member whose صحبة is already on goes to the list.
 */

import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CircleListSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import { RedeemInvite } from '@/components/circles/RedeemInvite';
import { useCircleAccess, useCircleUserId } from '@/lib/api/circles';
import { PageHeader, Screen } from '@/ui';

export default function InviteLinkScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const userId = useCircleUserId();
  const access = useCircleAccess();
  if (userId && access.data?.enabled) return <Redirect href="/circles" />;
  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={t('circles.invites.redeemTitle')} />
      {!userId ? <CirclesSignedOut /> : access.isPending ? <CircleListSkeleton /> : <RedeemInvite initialCode={typeof code === 'string' ? code : ''} />}
    </Screen>
  );
}
