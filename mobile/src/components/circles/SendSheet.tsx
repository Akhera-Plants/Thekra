/**
 * «أرسل رسالة» (owner round 7, D6: «بدي خيارات تقترحها علي … يشاركهم تقدمه بالعادات أو يشجع غيره وغيره يشجعه أو
 * يعينه برسالة ويثبته على طاعة»): suggested lines grouped by what the صحبة is for. «شارك تقدّمك» fills in today's
 * habits as two numbers (no habit is named; the sin program is never counted); «شجّع» and «ذكّر وثبّت» can go to
 * one member; «اطلب العون» goes to all. A line already sent today to the same person shows a check and waits for
 * tomorrow. There is no free text.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { useSendMessage } from '@/lib/api/circles';
import { circleErrorKey, habitProgress, wasSentToday } from '@/lib/circles/circle-view';
import { today } from '@/lib/practice/practice-store';
import { useDayAgenda } from '@/lib/practice/use-habits-hub';
import {
  DIRECTED_GROUPS,
  PRESET_GROUP_KEYS,
  PRESET_GROUPS,
  WHOLE_CIRCLE,
  type CircleDetail,
  type PresetGroup,
  type PresetKey,
} from '@/lib/types/circles';
import { space } from '@/theme';
import { BottomSheet, Button, Chip, ErrorText, SegmentTabs, Text, Wrap, toast } from '@/ui';

export function SendSheet({ circle, visible, onClose }: { circle: CircleDetail; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const send = useSendMessage(circle.id);
  const progress = habitProgress(useDayAgenda(today()));
  const [group, setGroup] = useState<PresetGroup>('progress');
  const [target, setTarget] = useState<string>(WHOLE_CIRCLE);
  const others = circle.members.filter((m) => !m.isMe);
  const directed = DIRECTED_GROUPS.includes(group);
  const to = directed ? target : WHOLE_CIRCLE;

  const lineText = (key: PresetKey): string => {
    if (key === 'progress' && progress) {
      return progress.done >= progress.total
        ? t('circles.lines.progressAll')
        : t('circles.lines.progress', { done: progress.done, total: progress.total });
    }
    return t(to === WHOLE_CIRCLE ? `circles.lines.${key}` : `circles.linesTo.${key}`);
  };

  const handleSend = (key: PresetKey) => {
    send.mutate(
      {
        key,
        toMemberId: to === WHOLE_CIRCLE ? undefined : to,
        progress: key === 'progress' && progress ? progress : undefined,
      },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          toast(t('circles.send.sent'));
          onClose();
        },
      },
    );
  };

  const keys = (PRESET_GROUPS[group] as readonly PresetKey[]).filter((k) => k !== 'progress' || progress !== null);

  return (
    <BottomSheet visible={visible} title={t('circles.send.title')} onClose={onClose}>
      <Text variant="small" tone="muted">
        {t('circles.send.lead')}
      </Text>
      <SegmentTabs
        items={PRESET_GROUP_KEYS.map((g) => ({ key: g, label: t(`circles.send.groups.${g}`) }))}
        value={group}
        onChange={(g) => {
          setGroup(g);
          send.reset();
        }}
      />
      {directed && others.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label">{t('circles.send.to')}</Text>
          <Wrap>
            <Chip label={t('circles.toCircle')} selected={target === WHOLE_CIRCLE} onPress={() => setTarget(WHOLE_CIRCLE)} />
            {others.map((m) => (
              <Chip key={m.memberId} label={m.displayName} selected={target === m.memberId} onPress={() => setTarget(m.memberId)} />
            ))}
          </Wrap>
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        {keys.map((key) => {
          const sent = wasSentToday(circle.sentToday, key, to) && key !== 'progress';
          return (
            <Button
              key={key}
              variant="outline"
              block
              icon={sent ? Check : undefined}
              label={lineText(key)}
              accessibilityLabel={sent ? `${lineText(key)}. ${t('circles.send.sentA11y')}` : undefined}
              onPress={() => handleSend(key)}
              disabled={sent || send.isPending}
            />
          );
        })}
        {group === 'progress' ? (
          <Text variant="caption" tone="muted">
            {progress ? t('circles.send.progressFrom') : t('circles.send.noHabitsToday')}
          </Text>
        ) : null}
      </View>
      {send.isError ? <ErrorText>{t(circleErrorKey(send.error))}</ErrorText> : null}
    </BottomSheet>
  );
}
