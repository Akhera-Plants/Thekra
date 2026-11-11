/**
 * «صحبة»: my private circles. Round 6 (C-01k): صحبة is invite-only. Signed out it invites sign-in; while صحبة is not on
 * for me (`GET /circles/access`) it shows «لديّ دعوة» only (RedeemInvite); once on: my circles (or the empty state)
 * with «أنشئ صحبة» and «لديّ دعوة» (round 8: the one entry for an invitation; inviting is «ادعُ» on a صحبة's own
 * page, for its owner). Each row says how many members and whether my presence shows there. No counts of days, no
 * ranking.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock, Users } from 'lucide-react-native';
import { CircleListSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import { RedeemInvite } from '@/components/circles/RedeemInvite';
import { useCircleAccess, useCircleUserId, useMyCircles } from '@/lib/api/circles';
import { circleErrorKey } from '@/lib/circles/circle-view';
import { useAuthStore } from '@/lib/stores/auth-store';
import { CIRCLES_PER_USER_MAX, type CircleSummary } from '@/lib/types/circles';
import { space } from '@/theme';
import { ButtonPair, EmptyState, ErrorState, ListRow, Notice, PageHeader, Screen, Text } from '@/ui';

const openCreate = () => router.push('/circles/create');
const openRedeem = () => router.push('/circles/redeem');

function CircleRow({ circle }: { circle: CircleSummary }) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => router.push(`/circles/${circle.id}`), [circle.id]);
  const hint = [
    t('circles.members', { count: circle.memberCount }),
    circle.isOwner ? t('circles.owner') : null,
    t(circle.sharesPresence ? 'circles.sharing' : 'circles.notSharing'),
  ]
    .filter(Boolean)
    .join(' · ');
  return <ListRow icon={Users} title={circle.name} hint={hint} onPress={handlePress} />;
}

function Actions({ count }: { count: number }) {
  const { t } = useTranslation();
  const isAtLimit = count >= CIRCLES_PER_USER_MAX;
  return (
    <View style={{ gap: space.sm }}>
      <ButtonPair
        size="lg"
        primary={{ label: t('circles.create'), onPress: openCreate, disabled: isAtLimit }}
        secondary={{ label: t('circles.join'), onPress: openRedeem }}
      />
      {isAtLimit ? (
        <Text variant="caption" tone="muted">
          {t('circles.limitNote')}
        </Text>
      ) : null}
    </View>
  );
}

/** صحبة on: the circles; off: the invite code only. */
function Access() {
  const { t } = useTranslation();
  const access = useCircleAccess();
  if (access.isPending) return <CircleListSkeleton />;
  if (access.isError) return <ErrorState message={t(circleErrorKey(access.error))} onRetry={() => void access.refetch()} />;
  if (!access.data.enabled) return <RedeemInvite />;
  return <CircleList />;
}

function CircleList() {
  const { t } = useTranslation();
  const circles = useMyCircles();
  if (circles.isPending) return <CircleListSkeleton />;
  if (circles.isError) return <ErrorState message={t(circleErrorKey(circles.error))} onRetry={() => void circles.refetch()} />;
  if (circles.data.length === 0) {
    return (
      <>
        <EmptyState icon={Users} message={t('circles.empty')} hint={t('circles.emptyHint')} />
        <Actions count={0} />
      </>
    );
  }
  return (
    <>
      <View>
        {circles.data.map((circle) => (
          <CircleRow key={circle.id} circle={circle} />
        ))}
      </View>
      <Actions count={circles.data.length} />
    </>
  );
}

export default function CirclesScreen() {
  const { t } = useTranslation();
  const userId = useCircleUserId();
  const isRestoringSession = useAuthStore((s) => s.isLoading);
  const circles = useMyCircles();
  return (
    <Screen edges={['bottom']} refreshing={circles.isRefetching} onRefresh={userId ? () => void circles.refetch() : undefined}>
      <PageHeader title={t('circles.title')} lead={t('circles.lead')} />
      {userId ? <Access /> : isRestoringSession ? <CircleListSkeleton /> : <CirclesSignedOut />}
      <Notice icon={Lock}>{t('circles.privacyNote')}</Notice>
    </Screen>
  );
}
