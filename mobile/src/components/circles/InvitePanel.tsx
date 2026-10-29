/**
 * The owner's invite: the code (grouped for reading aloud), sharing it through the system share sheet as a short
 * message with the app link, and changing it (the old one stops working). Only the owner receives the code.
 */

import React, { useCallback } from 'react';
import { Alert, Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Share2 } from 'lucide-react-native';
import { useRotateInviteCode } from '@/lib/api/circles';
import { circleErrorKey, formatInviteCode, inviteLink } from '@/lib/circles/circle-view';
import type { CircleDetail } from '@/lib/types/circles';
import { space } from '@/theme';
import { Button, ErrorText, Row, Section, Text } from '@/ui';

export function InvitePanel({ circle }: { circle: CircleDetail }) {
  const { t } = useTranslation();
  const rotate = useRotateInviteCode(circle.id);
  const code = circle.inviteCode;
  const isFull = circle.memberCount >= circle.maxMembers;

  const handleShare = useCallback(() => {
    if (!code) return;
    const message = t('circles.shareMessage', { name: circle.name, code: formatInviteCode(code), link: inviteLink(code) });
    void Share.share({ message }).catch(() => undefined);
  }, [circle.name, code, t]);

  const handleRotate = useCallback(() => {
    Alert.alert(t('circles.rotateConfirmTitle'), t('circles.rotateConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('circles.rotate'), style: 'destructive', onPress: () => rotate.mutate() },
    ]);
  }, [rotate, t]);

  if (!code) return null;
  return (
    <Section title={t('circles.inviteTitle')} lead={t('circles.inviteLead')}>
      <View style={{ gap: space.md }}>
        <Text variant="title" selectable accessibilityLabel={code.split('').join(' ')} style={{ writingDirection: 'ltr', letterSpacing: 2 }}>
          {formatInviteCode(code)}
        </Text>
        {isFull ? (
          <Text variant="small" tone="muted">
            {t('circles.full', { count: circle.memberCount, max: circle.maxMembers })}
          </Text>
        ) : null}
        <Row style={{ flexWrap: 'wrap' }}>
          <Button label={t('circles.shareInvite')} icon={Share2} onPress={handleShare} />
          <Button label={t('circles.rotate')} icon={RefreshCw} variant="ghost" onPress={handleRotate} loading={rotate.isPending} />
        </Row>
        {rotate.isError ? <ErrorText>{t(circleErrorKey(rotate.error))}</ErrorText> : null}
      </View>
    </Section>
  );
}
