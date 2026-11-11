/**
 * `thekra://circles/invite/<code>`: the link behind «افتح في التطبيق» on the website's invite page. It is the same
 * screen as «لديّ دعوة» with the code from the link filled in (see `../redeem.tsx`), for an account whose صحبة is off
 * and for one that is already in a صحبة (a second one).
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
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
  return (
    <Screen edges={['bottom']} keyboard>
      <PageHeader title={t('circles.invites.redeemTitle')} />
      {!userId ? <CirclesSignedOut /> : access.isPending ? <CircleListSkeleton /> : <RedeemInvite initialCode={typeof code === 'string' ? code : ''} />}
    </Screen>
  );
}
