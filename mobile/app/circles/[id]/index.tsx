/**
 * A صحبة (owner round 7): its name and «نيّتنا» with «ادعُ» (owner only, D3; round 8: a personal invite tied to this صحبة) and «إعداداتي» (D2) as controls on the
 * title's line; «إنجازات الصحبة خلال آخر 7 أيام» (D4); then «رسائل الصحبة» (D7): my running round with «تم الحمد لله»
 * / «لم يتم» (D5), the chat-like feed (الكل · المحفوظة), and the two ways to speak in it, «ابدأ جولة» and «أرسل رسالة»
 * (suggested lines, D6). Reports (D8) open from a line's options. The days end on this device's today.
 */

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MessageCirclePlus, Settings2, Timer, UserPlus, Users } from 'lucide-react-native';
import { CircleDetailSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import { CircleFeed } from '@/components/circles/CircleFeed';
import { InviteSheet } from '@/components/circles/InviteSheet';
import { ReportSheet, type ReportTarget } from '@/components/circles/ReportSheet';
import { AnotherRound, RunningRound } from '@/components/circles/RoundBar';
import { SendSheet } from '@/components/circles/SendSheet';
import { StartRoundSheet, type RoundDraft } from '@/components/circles/StartRoundSheet';
import { WeekMarks } from '@/components/circles/WeekMarks';
import { useCircle, useCircleUserId, useEndRound, useStartRound } from '@/lib/api/circles';
import { circleErrorKey } from '@/lib/circles/circle-view';
import { today } from '@/lib/practice/practice-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ApiError } from '@/lib/types/api';
import type { CircleDetail } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, ButtonPair, Chip, EmptyState, ErrorState, IconButton, PageHeader, Row, Screen, Section, SectionDivider, Text, toast } from '@/ui';

const openList = () => router.dismissTo('/circles');

function HeaderActions({ circle, onInvite }: { circle: CircleDetail; onInvite: () => void }) {
  const { t } = useTranslation();
  const openSettings = useCallback(() => router.push(`/circles/${circle.id}/settings`), [circle.id]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      {circle.me.isOwner ? <Button label={t('circles.inviteButton')} icon={UserPlus} variant="outline" size="sm" onPress={onInvite} /> : null}
      <IconButton icon={Settings2} label={t('circles.settings')} tone="link" bordered onPress={openSettings} />
    </View>
  );
}

function Rounds({ circle, onEdit }: { circle: CircleDetail; onEdit: (draft: RoundDraft) => void }) {
  const { t } = useTranslation();
  const end = useEndRound(circle.id);
  const start = useStartRound(circle.id);
  const [again, setAgain] = useState<RoundDraft | null>(null);
  const round = circle.myOpenRound;

  if (round) {
    return (
      <RunningRound
        round={round}
        pending={end.isPending}
        error={end.error}
        onEnd={(outcome) =>
          end.mutate(
            { roundId: round.id, outcome },
            {
              onSuccess: () => {
                toast(t(outcome === 'done' ? 'circles.round.endedDone' : 'circles.round.endedNotDone'));
                setAgain(outcome === 'done' ? { kind: round.kind, label: round.label ?? undefined, minutes: round.minutes } : null);
              },
            },
          )
        }
      />
    );
  }
  if (!again) return null;
  return (
    <AnotherRound
      last={again}
      pending={start.isPending}
      onDismiss={() => setAgain(null)}
      onEdit={() => {
        onEdit(again);
        setAgain(null);
      }}
      onSame={() =>
        start.mutate(
          { ...again, today: today() },
          {
            onSuccess: () => {
              toast(t('circles.round.started'));
              setAgain(null);
            },
            onError: (error) => toast(t(circleErrorKey(error))),
          },
        )
      }
    />
  );
}

function CircleBody({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [roundSheet, setRoundSheet] = useState<{ initial: RoundDraft | null } | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [saved, setSaved] = useState(false);
  const hasOpenRound = circle.myOpenRound !== null;

  return (
    <>
      <PageHeader title={circle.name} lead={circle.intention ?? undefined} action={<HeaderActions circle={circle} onInvite={() => setInviteOpen(true)} />}>
        <Text variant="small" tone="muted">
          {t('circles.members', { count: circle.memberCount })}
        </Text>
      </PageHeader>
      <WeekMarks days={circle.days} members={circle.members} sharing={circle.me.sharesPresence} />
      <SectionDivider />
      <Section
        title={t('circles.feed.title')}
        action={
          <Row style={{ gap: space.xs }}>
            <Chip label={t('circles.feed.all')} selected={!saved} onPress={() => setSaved(false)} />
            <Chip label={t('circles.feed.saved')} selected={saved} onPress={() => setSaved(true)} />
          </Row>
        }
      >
        <Rounds circle={circle} onEdit={(draft) => setRoundSheet({ initial: draft })} />
        <CircleFeed circle={circle} saved={saved} onReport={setReport} />
        {hasOpenRound ? (
          <Button label={t('circles.feed.send')} icon={MessageCirclePlus} variant="outline" size="lg" onPress={() => setSendOpen(true)} />
        ) : (
          <ButtonPair
            size="lg"
            primary={{ label: t('circles.round.start'), icon: Timer, onPress: () => setRoundSheet({ initial: null }) }}
            secondary={{ label: t('circles.feed.send'), icon: MessageCirclePlus, onPress: () => setSendOpen(true) }}
          />
        )}
      </Section>
      <InviteSheet circle={circle} visible={inviteOpen} onClose={() => setInviteOpen(false)} />
      <SendSheet circle={circle} visible={sendOpen} onClose={() => setSendOpen(false)} />
      <StartRoundSheet circleId={circle.id} visible={roundSheet !== null} initial={roundSheet?.initial ?? null} onClose={() => setRoundSheet(null)} />
      <ReportSheet circleId={circle.id} target={report} onClose={() => setReport(null)} />
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
