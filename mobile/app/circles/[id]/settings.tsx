/**
 * My settings in a circle: my name there, whether my «حضرت اليوم» shows (off by default; turning it off deletes the
 * marks already shared), leaving. The owner also removes members and deletes the circle. Every destructive step asks
 * first.
 */

import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LogOut, Trash2, UserX } from 'lucide-react-native';
import { CircleDetailSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import {
  markPresence,
  useCircle,
  useCircleUserId,
  useDeleteCircle,
  useLeaveCircle,
  useRemoveMember,
  useUpdateMembership,
} from '@/lib/api/circles';
import { circleErrorKey, loggedOn } from '@/lib/circles/circle-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { CIRCLE_TEXT_MAX, type CircleDetail, type CircleMember } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, ErrorState, ErrorText, Field, ListRow, PageHeader, Rule, Screen, Section, SwitchRow, Text } from '@/ui';

const backToList = () => router.dismissTo('/circles');

function confirm(title: string, body: string, action: string, cancel: string, onConfirm: () => void) {
  Alert.alert(title, body, [
    { text: cancel, style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

function MyMembership({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const update = useUpdateMembership(circle.id);
  const [name, setName] = useState(circle.me.displayName);
  const isNameChanged = name.trim().length > 0 && name.trim() !== circle.me.displayName;

  const handleSaveName = useCallback(() => update.mutate({ displayName: name.trim() }), [name, update]);
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

function MemberRow({ circleId, member }: { circleId: string; member: CircleMember }) {
  const { t } = useTranslation();
  const remove = useRemoveMember(circleId);
  const handleRemove = useCallback(
    () =>
      confirm(
        t('circles.removeConfirmTitle', { name: member.displayName }),
        t('circles.removeConfirmBody'),
        t('circles.remove', { name: member.displayName }),
        t('common.cancel'),
        () => remove.mutate(member.memberId),
      ),
    [member, remove, t],
  );
  return (
    <ListRow
      title={member.displayName}
      trailing={
        <Button
          label={t('circles.remove', { name: member.displayName })}
          icon={UserX}
          variant="ghost"
          onPress={handleRemove}
          loading={remove.isPending}
          accessibilityLabel={t('circles.remove', { name: member.displayName })}
        />
      }
    />
  );
}

function OwnerMembers({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const others = circle.members.filter((m) => !m.isMe);
  if (others.length === 0) return null;
  return (
    <Section title={t('circles.membersTitle')}>
      <View>
        {others.map((member) => (
          <MemberRow key={member.memberId} circleId={circle.id} member={member} />
        ))}
      </View>
    </Section>
  );
}

function LeaveAndDelete({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const leave = useLeaveCircle(circle.id);
  const remove = useDeleteCircle(circle.id);
  const handleLeave = useCallback(
    () =>
      confirm(
        t('circles.leaveConfirmTitle'),
        t(circle.me.isOwner ? 'circles.leaveOwnerBody' : 'circles.leaveConfirmBody'),
        t('circles.leave'),
        t('common.cancel'),
        () => leave.mutate(undefined, { onSuccess: backToList }),
      ),
    [circle.me.isOwner, leave, t],
  );
  const handleDelete = useCallback(
    () =>
      confirm(t('circles.deleteConfirmTitle'), t('circles.deleteConfirmBody'), t('circles.deleteCircle'), t('common.cancel'), () =>
        remove.mutate(undefined, { onSuccess: backToList }),
      ),
    [remove, t],
  );
  const failure = leave.error ?? remove.error;
  return (
    <View style={{ gap: space.sm }}>
      <Button label={t('circles.leave')} icon={LogOut} variant="destructive" onPress={handleLeave} loading={leave.isPending} block />
      {circle.me.isOwner ? (
        <Button label={t('circles.deleteCircle')} icon={Trash2} variant="destructive" onPress={handleDelete} loading={remove.isPending} block />
      ) : null}
      {failure ? <ErrorText>{t(circleErrorKey(failure))}</ErrorText> : null}
    </View>
  );
}

function SettingsContent({ id }: { id: string }) {
  const { t } = useTranslation();
  const circle = useCircle(id, today());
  if (circle.isPending) return <CircleDetailSkeleton />;
  if (circle.isError) return <ErrorState message={t(circleErrorKey(circle.error))} onRetry={() => void circle.refetch()} />;
  return (
    <>
      <PageHeader eyebrow={circle.data.name} title={t('circles.settingsTitle')} />
      <MyMembership circle={circle.data} />
      {circle.data.me.isOwner ? <OwnerMembers circle={circle.data} /> : null}
      <Rule />
      <LeaveAndDelete circle={circle.data} />
      <Text variant="caption" tone="muted">
        {t('circles.privacyNote')}
      </Text>
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
