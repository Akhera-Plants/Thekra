/**
 * «رفقة»: my private circles. Signed out it invites sign-in; with none it explains and offers to start one or join
 * with a code. Each row says how many members and whether my presence shows there. No counts of days, no ranking.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock, Users } from 'lucide-react-native';
import { CircleListSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import { useCircleUserId, useMyCircles } from '@/lib/api/circles';
import { circleErrorKey } from '@/lib/circles/circle-view';
import { useAuthStore } from '@/lib/stores/auth-store';
import { CIRCLES_PER_USER_MAX, type CircleSummary } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, EmptyState, ErrorState, ListRow, Notice, PageHeader, Screen, Text } from '@/ui';

const openCreate = () => router.push('/circles/create');
const openJoin = () => router.push('/circles/join');

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
      <Button label={t('circles.create')} onPress={openCreate} disabled={isAtLimit} block />
      <Button label={t('circles.join')} onPress={openJoin} variant="outline" disabled={isAtLimit} block />
      {isAtLimit ? (
        <Text variant="caption" tone="muted">
          {t('circles.limitNote')}
        </Text>
      ) : null}
    </View>
  );
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
      {userId ? <CircleList /> : isRestoringSession ? <CircleListSkeleton /> : <CirclesSignedOut />}
      <Notice icon={Lock}>{t('circles.privacyNote')}</Notice>
    </Screen>
  );
}
