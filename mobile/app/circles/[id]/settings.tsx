/**
 * My settings in a صحبة (opened from the settings icon at the top of the page, owner round 7, D2): my name there,
 * whether my «حضرت اليوم» shows (off by default; turning it off deletes the marks already shared), the members with
 * a «⋯» each (report, hide or show their messages, and for the owner remove them), leaving, and for the owner
 * deleting the صحبة. Every destructive step asks first in our own dialog.
 */

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Flag, LogOut, Trash2, UserX } from 'lucide-react-native';
import { CircleDetailSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import { ReportSheet, type ReportTarget } from '@/components/circles/ReportSheet';
import {
  markPresence,
  useCircle,
  useCircleUserId,
  useDeleteCircle,
  useLeaveCircle,
  useMuteMember,
  useRemoveMember,
  useUpdateMembership,
} from '@/lib/api/circles';
import { circleErrorKey, loggedOn } from '@/lib/circles/circle-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { CIRCLE_TEXT_MAX, type CircleDetail, type CircleMember } from '@/lib/types/circles';
import { space } from '@/theme';
import {
  ActionMenu,
  Button,
  ErrorState,
  ErrorText,
  Field,
  ListRow,
  PageHeader,
  Screen,
  Section,
  SectionDivider,
  SwitchRow,
  Text,
  confirm,
  toast,
  type ActionMenuItem,
} from '@/ui';

const backToList = () => router.dismissTo('/circles');

function MyMembership({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const update = useUpdateMembership(circle.id);
  const [name, setName] = useState(circle.me.displayName);
  const isNameChanged = name.trim().length > 0 && name.trim() !== circle.me.displayName;

  const handleSaveName = useCallback(
    () => update.mutate({ displayName: name.trim() }, { onSuccess: () => toast(t('circles.saved')) }),
    [name, t, update],
  );
  const handleSharing = useCallback(
    (on: boolean) => {
      update.mutate(
        { sharesPresence: on },
        {
          // The hub posts only when today's log changes; post today's mark now if there already is one.
          onSuccess: () => {
            const date = today();
            if (on && loggedOn(usePracticeStore.getState().store, date)) void markPresence(date).catch(() => undefined);
          },
        },
      );
    },
    [update],
  );

  return (
    <View style={{ gap: space.lg }}>
      <Field
        label={t('circles.displayNameLabel')}
        hint={t('circles.displayNameHint')}
        value={name}
        onChangeText={setName}
        maxLength={CIRCLE_TEXT_MAX.displayName}
        autoComplete="name"
        textContentType="nickname"
      />
      <Button label={t('circles.saveName')} variant="outline" onPress={handleSaveName} disabled={!isNameChanged || update.isPending} />
      <SwitchRow
        label={t('circles.shareLabel')}
        hint={t('circles.shareHint')}
        value={circle.me.sharesPresence}
        onValueChange={handleSharing}
        disabled={update.isPending}
      />
      {update.isError ? <ErrorText>{t(circleErrorKey(update.error))}</ErrorText> : null}
    </View>
  );
}

function MemberRow({
  circle,
  member,
  last,
  onReport,
}: {
  circle: CircleDetail;
  member: CircleMember;
  last: boolean;
  onReport: (target: ReportTarget) => void;
}) {
  const { t } = useTranslation();
  const remove = useRemoveMember(circle.id);
  const mute = useMuteMember(circle.id);
  const name = member.displayName;
  const isMuted = circle.mutedMemberIds.includes(member.memberId);
  const items: ActionMenuItem[] = [
    // The report sheet opens once the menu's sheet has gone (iOS presents one modal at a time).
    { label: t('circles.feed.reportMember', { name }), icon: Flag, onPress: () => setTimeout(() => onReport({ kind: 'member', memberId: member.memberId, name }), 350) },
    {
      label: isMuted ? t('circles.unmute', { name }) : t('circles.feed.hideMember', { name }),
      icon: isMuted ? Eye : EyeOff,
      onPress: () =>
        mute.mutate(
          { memberId: member.memberId, muted: !isMuted },
          { onSuccess: () => toast(isMuted ? t('circles.unmuted', { name }) : t('circles.feed.hidden', { name })) },
        ),
    },
    ...(circle.me.isOwner
      ? [
          {
            label: t('circles.remove', { name }),
            icon: UserX,
            destructive: true,
            confirm: { title: t('circles.removeConfirmTitle', { name }), message: t('circles.removeConfirmBody'), confirmLabel: t('circles.remove', { name }) },
            onPress: () => remove.mutate(member.memberId),
          },
        ]
      : []),
  ];
  const hint = [member.isOwner ? t('circles.owner') : null, isMuted ? t('circles.mutedHint') : null].filter(Boolean).join(' · ');
  return (
    <ListRow
      title={name}
      hint={hint || undefined}
      last={last}
      trailing={<ActionMenu label={t('circles.memberActions', { name })} items={items} />}
    />
  );
}

function Members({ circle, onReport }: { circle: CircleDetail; onReport: (target: ReportTarget) => void }) {
  const { t } = useTranslation();
  const others = circle.members.filter((m) => !m.isMe);
  if (others.length === 0) return null;
  return (
    <Section title={t('circles.membersTitle')}>
      <View>
        {others.map((member, i) => (
          <MemberRow key={member.memberId} circle={circle} member={member} last={i === others.length - 1} onReport={onReport} />
        ))}
      </View>
    </Section>
  );
}

function LeaveAndDelete({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const leave = useLeaveCircle(circle.id);
  const remove = useDeleteCircle(circle.id);
  const handleLeave = useCallback(async () => {
    const ok = await confirm({
      title: t('circles.leaveConfirmTitle'),
      message: t(circle.me.isOwner ? 'circles.leaveOwnerBody' : 'circles.leaveConfirmBody'),
      confirmLabel: t('circles.leave'),
      tone: 'destructive',
    });
    if (ok) leave.mutate(undefined, { onSuccess: backToList });
  }, [circle.me.isOwner, leave, t]);
  const handleDelete = useCallback(async () => {
    const ok = await confirm({
      title: t('circles.deleteConfirmTitle'),
      message: t('circles.deleteConfirmBody'),
      confirmLabel: t('circles.deleteCircle'),
      tone: 'destructive',
    });
    if (ok) remove.mutate(undefined, { onSuccess: backToList });
  }, [remove, t]);
  const failure = leave.error ?? remove.error;
  return (
    <View style={{ gap: space.sm }}>
      <Button label={t('circles.leave')} icon={LogOut} variant="destructive" onPress={() => void handleLeave()} loading={leave.isPending} block />
      {circle.me.isOwner ? (
        <Button label={t('circles.deleteCircle')} icon={Trash2} variant="destructive" onPress={() => void handleDelete()} loading={remove.isPending} block />
      ) : null}
      {failure ? <ErrorText>{t(circleErrorKey(failure))}</ErrorText> : null}
    </View>
  );
}

function SettingsContent({ id }: { id: string }) {
  const { t } = useTranslation();
  const circle = useCircle(id, today());
  const [report, setReport] = useState<ReportTarget | null>(null);
  if (circle.isPending) return <CircleDetailSkeleton />;
  if (circle.isError) return <ErrorState message={t(circleErrorKey(circle.error))} onRetry={() => void circle.refetch()} />;
  return (
    <>
      <PageHeader eyebrow={circle.data.name} title={t('circles.settingsTitle')} />
      <MyMembership circle={circle.data} />
      <Members circle={circle.data} onReport={setReport} />
      <SectionDivider />
      <LeaveAndDelete circle={circle.data} />
      <Text variant="caption" tone="muted">
        {t('circles.privacyNote')}
      </Text>
      <ReportSheet circleId={circle.data.id} target={report} onClose={() => setReport(null)} />
    </>
  );
}

export default function CircleSettingsScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const userId = useCircleUserId();
  return (
    <Screen edges={['bottom']} keyboard>
      {userId ? <SettingsContent id={id} /> : <CirclesSignedOut />}
    </Screen>
  );
}
