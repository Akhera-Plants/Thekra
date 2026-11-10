/**
 * «دعوة» (owner round 7, D3): the owner's invite in a sheet opened from the button at the top of the صحبة page. The
 * code sits in its own full-width block on a tinted background (grouped for reading aloud, copy beside it), then
 * «شارك الرمز» (the system share sheet: a short message with the app link) and «غيّر الرمز». Changing the code asks
 * first inside the same sheet (the old code stops working). Only the owner receives the code.
 */

import React, { useCallback, useState } from 'react';
import { Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Copy, RefreshCw, Share2 } from 'lucide-react-native';
import { useRotateInviteCode } from '@/lib/api/circles';
import { circleErrorKey, formatInviteCode, inviteLink } from '@/lib/circles/circle-view';
import type { CircleDetail } from '@/lib/types/circles';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, ButtonPair, ErrorText, IconButton, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  code: {
    alignSelf: 'stretch' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingVertical: space.lg,
    paddingStart: space.xl,
    paddingEnd: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.ring,
    backgroundColor: t.colors.primarySoft,
  },
  codeText: { flex: 1, gap: 2 },
});

export function InviteSheet({ circle, visible, onClose }: { circle: CircleDetail; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const rotate = useRotateInviteCode(circle.id);
  const [asking, setAsking] = useState(false);
  const code = circle.inviteCode;
  const isFull = circle.memberCount >= circle.maxMembers;

  const handleShare = useCallback(() => {
    if (!code) return;
    const message = t('circles.shareMessage', { name: circle.name, code: formatInviteCode(code), link: inviteLink(code) });
    void Share.share({ message }).catch(() => undefined);
  }, [circle.name, code, t]);

  const handleCopy = useCallback(() => {
    if (!code) return;
    void Clipboard.setStringAsync(code)
      .then(() => toast(t('circles.codeCopied')))
      .catch(() => undefined);
  }, [code, t]);

  const handleRotate = useCallback(() => {
    setAsking(false);
    rotate.mutate(undefined, { onSuccess: () => toast(t('circles.rotated')) });
  }, [rotate, t]);

  const close = useCallback(() => {
    setAsking(false);
    onClose();
  }, [onClose]);

  if (!code) return null;
  return (
    <BottomSheet
      visible={visible}
      title={asking ? t('circles.rotateConfirmTitle') : t('circles.inviteTitle')}
      onClose={close}
      footer={
        asking ? (
          <ButtonPair
            size="lg"
            primary={{ label: t('circles.rotate'), onPress: handleRotate, variant: 'danger' }}
            secondary={{ label: t('common.cancel'), onPress: () => setAsking(false) }}
          />
        ) : (
          <ButtonPair
            size="lg"
            primary={{ label: t('circles.shareInvite'), icon: Share2, onPress: handleShare }}
            secondary={{ label: t('circles.rotate'), icon: RefreshCw, onPress: () => setAsking(true), loading: rotate.isPending }}
          />
        )
      }
    >
      {asking ? (
        <Text variant="body">{t('circles.rotateConfirmBody')}</Text>
      ) : (
        <>
          <Text variant="small" tone="muted">
            {t('circles.inviteLead')}
          </Text>
          <View style={styles.code}>
            <View style={styles.codeText}>
              <Text variant="caption" tone="muted">
                {t('circles.codeCaption')}
              </Text>
              {/* An invite code reads left to right in both languages. */}
              <Text
                variant="title"
                weight="semibold"
                tone="link"
                selectable
                accessibilityLabel={code.split('').join(' ')}
                style={{ writingDirection: 'ltr', letterSpacing: 3 }}
              >
                {formatInviteCode(code)}
              </Text>
            </View>
            <IconButton icon={Copy} label={t('circles.copyCode')} tone="link" onPress={handleCopy} />
          </View>
          {isFull ? (
            <Text variant="small" tone="muted">
              {t('circles.full', { count: circle.memberCount, max: circle.maxMembers })}
            </Text>
          ) : null}
          {rotate.isError ? <ErrorText>{t(circleErrorKey(rotate.error))}</ErrorText> : null}
        </>
      )}
    </BottomSheet>
  );
}
