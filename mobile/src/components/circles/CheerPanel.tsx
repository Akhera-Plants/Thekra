/**
 * Cheers: the latest preset lines that reached me (or the whole circle), then «أرسل كلمة طيبة»: pick the whole
 * circle or one member, then one of the preset lines. One per target per day; a target already cheered today shows
 * «أُرسلت اليوم» instead of the lines. No free text exists, so nothing needs moderation.
 */

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSendCheer } from '@/lib/api/circles';
import { circleErrorKey } from '@/lib/circles/circle-view';
import { CHEER_MESSAGES, WHOLE_CIRCLE, type CheerMessage, type CircleDetail } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, Chip, ErrorText, Section, Text, Wrap } from '@/ui';

function Received({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  if (circle.cheers.length === 0) {
    return (
      <Text variant="small" tone="muted">
        {t('circles.cheersEmpty')}
      </Text>
    );
  }
  return (
    <View style={{ gap: space.md }}>
      {circle.cheers.map((cheer) => (
        <View key={cheer.id} style={{ gap: 2 }}>
          <Text variant="body">{t(cheer.toMe ? `circles.cheer.${cheer.message}` : `circles.cheerAll.${cheer.message}`)}</Text>
          <Text variant="caption" tone="muted">
            {cheer.toMe ? t('circles.cheerFrom', { name: cheer.fromName }) : `${t('circles.cheerFrom', { name: cheer.fromName })} · ${t('circles.cheerToAll')}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Send({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const send = useSendCheer(circle.id);
  const others = circle.members.filter((m) => !m.isMe);
  const [target, setTarget] = useState<string>(WHOLE_CIRCLE);
  const isSent = circle.cheeredToday.includes(target);

  const handleSend = useCallback(
    (message: CheerMessage) => {
      send.mutate(
        { message, toMemberId: target === WHOLE_CIRCLE ? undefined : target },
        { onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
      );
    },
    [send, target],
  );

  return (
    <View style={{ gap: space.md }}>
      <Wrap>
        <Chip label={t('circles.toCircle')} selected={target === WHOLE_CIRCLE} onPress={() => setTarget(WHOLE_CIRCLE)} />
        {others.map((m) => (
          <Chip key={m.memberId} label={m.displayName} selected={target === m.memberId} onPress={() => setTarget(m.memberId)} />
        ))}
      </Wrap>
      {isSent ? (
        <Text variant="small" tone="muted">
          {t('circles.sentToday')}
        </Text>
      ) : (
        <View style={{ gap: space.sm }}>
          {CHEER_MESSAGES.map((message) => (
            <Button
              key={message}
              variant="outline"
              block
              label={t(target === WHOLE_CIRCLE ? `circles.cheerAll.${message}` : `circles.cheer.${message}`)}
              onPress={() => handleSend(message)}
              disabled={send.isPending}
            />
          ))}
        </View>
      )}
      {send.isError ? <ErrorText>{t(circleErrorKey(send.error))}</ErrorText> : null}
    </View>
  );
}

export function CheerPanel({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  return (
    <>
      <Section title={t('circles.cheersTitle')}>
        <Received circle={circle} />
      </Section>
      <Section title={t('circles.sendTitle')} lead={t('circles.sendLead')}>
        <Send circle={circle} />
      </Section>
    </>
  );
}
