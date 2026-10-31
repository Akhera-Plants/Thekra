/**
 * A circle: its name and «نيّتنا», the last 7 days as quiet marks per member, the cheers that reached me and the
 * preset lines to send, the owner's invite, and my settings. The days end on this device's today.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Lock, Settings2, Users } from 'lucide-react-native';
import { CheerPanel } from '@/components/circles/CheerPanel';
import { CircleDetailSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import { InvitePanel } from '@/components/circles/InvitePanel';
import { WeekMarks } from '@/components/circles/WeekMarks';
import { useCircle, useCircleUserId } from '@/lib/api/circles';
import { circleErrorKey } from '@/lib/circles/circle-view';
import { today } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ApiError } from '@/lib/types/api';
import type { CircleDetail } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, EmptyState, ErrorState, Notice, PageHeader, Screen, Section, Text } from '@/ui';

const openList = () => router.dismissTo('/circles');

function CircleBody({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const openSettings = useCallback(() => router.push(`/circles/${circle.id}/settings`), [circle.id]);
  return (
    <>
      <PageHeader title={circle.name} lead={circle.intention ?? undefined}>
        <Text variant="small" tone="muted">
          {t('circles.members', { count: circle.memberCount })}
        </Text>
      </PageHeader>
      <Section title={t('circles.weekTitle')} lead={t('circles.weekLead')}>
        <WeekMarks days={circle.days} members={circle.members} />
        {circle.me.sharesPresence ? null : <Notice icon={Lock}>{t('circles.notSharingHint')}</Notice>}
      </Section>
      <CheerPanel circle={circle} />
      <InvitePanel circle={circle} />
      <View style={{ gap: space.sm }}>
        <Button label={t('circles.settings')} icon={Settings2} variant="outline" onPress={openSettings} block />
      </View>
    </>
  );
}

function CircleContent({ id }: { id: string }) {
  const { t } = useTranslation();
  const circle = useCircle(id, today());
  if (circle.isPending) return <CircleDetailSkeleton />;
  if (circle.isError) {
    if (circle.error instanceof ApiError && circle.error.status === 404) {
      return <EmptyState icon={Users} message={t('circles.errors.notFound')} actionLabel={t('circles.title')} onAction={openList} />;
    }
    return <ErrorState message={t(circleErrorKey(circle.error))} onRetry={() => void circle.refetch()} />;
  }
  return <CircleBody circle={circle.data} />;
}

export default function CircleScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const userId = useCircleUserId();
  const isRestoringSession = useAuthStore((s) => s.isLoading);
  const circle = useCircle(id, today());
  return (
    <Screen edges={['bottom']} refreshing={circle.isRefetching} onRefresh={userId ? () => void circle.refetch() : undefined}>
      {userId ? <CircleContent id={id} /> : isRestoringSession ? <CircleDetailSkeleton /> : <CirclesSignedOut />}
    </Screen>
  );
}
