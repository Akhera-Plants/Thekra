/**
 * «ادعُ» (owner round 8, Q6): a PERSONAL invite tied to this صحبة, from the button at the top of its page (owner only).
 * «أنشئ دعوة وشاركها» makes one (works for one person, once, within 7 days) and opens the system share sheet with ONE
 * message: an https link that opens the website's invite page (which opens the app on the invite) and the code to type.
 * Under it, this صحبة's invites: the code, what it is for, until when, how many times it was used (0 or 1 of 1), «شارك»
 * again and «ألغِ» (asked first inside the same sheet). The inviter never learns who used an invite. The صحبة no longer
 * has a permanent reusable code to share.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Share, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Share2, XCircle } from 'lucide-react-native';
import { useCircleAccess, useCreateInvite, useMyInvites, useRevokeInvite } from '@/lib/api/circles';
import { useShortDate } from '@/lib/practice/use-habits-hub';
import { circleErrorKey, formatInviteCode, inviteShareLink } from '@/lib/circles/circle-view';
import type { LocalDate } from '@thekra/practice-core';
import type { CircleDetail, CircleInvite } from '@/lib/types/circles';
import { space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, ButtonPair, ErrorText, IconButton, Text, toast } from '@/ui';

/** Used or dead invites listed under the open ones. */
const PAST_LISTED = 3;

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});

export function InviteSheet({ circle, visible, onClose }: { circle: CircleDetail; visible: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const shortDate = useShortDate();
  const access = useCircleAccess();
  const invites = useMyInvites(visible);
  const create = useCreateInvite();
  const revoke = useRevokeInvite();
  const [revoking, setRevoking] = useState<CircleInvite | null>(null);
  const isFull = circle.memberCount >= circle.maxMembers;
  const limits = access.data?.invites ?? null;
  const canCreate = !isFull && (limits?.remaining ?? 1) > 0;

  const mine = useMemo(() => {
    const all = (invites.data ?? []).filter((i) => i.circle?.id === circle.id);
    const open = all.filter((i) => i.status === 'active' && i.code);
    const past = all.filter((i) => !(i.status === 'active' && i.code)).slice(0, PAST_LISTED);
    return [...open, ...past];
  }, [circle.id, invites.data]);

  const share = useCallback(
    (invite: CircleInvite) => {
      if (!invite.code) return;
      const message = t('circles.invites.shareMessage', {
        name: circle.name,
        code: formatInviteCode(invite.code),
        link: inviteShareLink(invite.code, i18n.language),
        date: shortDate(invite.expiresAt.slice(0, 10) as LocalDate),
      });
      void Share.share({ message }).catch(() => undefined);
    },
    [circle.name, i18n.language, shortDate, t],
  );

  const handleCreate = useCallback(() => {
    create.mutate(circle.id, {
      onSuccess: (invite) => {
        toast(t('circles.invites.created'));
        share(invite);
      },
    });
  }, [circle.id, create, share, t]);

  const handleRevoke = useCallback(() => {
    const invite = revoking;
    setRevoking(null);
    if (invite) revoke.mutate(invite.id, { onSuccess: () => toast(t('circles.invites.revoked')) });
  }, [revoke, revoking, t]);

  const close = useCallback(() => {
    setRevoking(null);
    onClose();
  }, [onClose]);

  return (
    <BottomSheet
      visible={visible}
      title={revoking ? t('circles.invites.revokeTitle') : t('circles.inviteTitle', { name: circle.name })}
      onClose={close}
      footer={
        revoking ? (
          <ButtonPair
            size="lg"
            primary={{ label: t('circles.invites.revoke'), onPress: handleRevoke, variant: 'danger' }}
            secondary={{ label: t('common.cancel'), onPress: () => setRevoking(null) }}
          />
        ) : (
          <Button label={t('circles.invites.make')} icon={Plus} size="lg" block onPress={handleCreate} loading={create.isPending} disabled={!canCreate} />
        )
      }
    >
      {revoking ? (
        <Text variant="body">{t('circles.invites.revokeBody')}</Text>
      ) : (
        <>
          <Text variant="small" tone="muted">
            {t('circles.inviteLead', { days: limits?.ttlDays ?? 7 })}
          </Text>
          {isFull ? (
            <Text variant="small" tone="muted">
              {t('circles.full', { count: circle.memberCount, max: circle.maxMembers })}
            </Text>
          ) : limits && limits.remaining <= 0 ? (
            <Text variant="small" tone="muted">
              {t('circles.invites.none', { days: limits.periodDays })}
            </Text>
          ) : null}
          {create.isError ? <ErrorText>{t(circleErrorKey(create.error))}</ErrorText> : null}
          {revoke.isError ? <ErrorText>{t(circleErrorKey(revoke.error))}</ErrorText> : null}
          {mine.length > 0 ? (
            <View>
              {mine.map((invite, i) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  rowStyle={[styles.row, i === mine.length - 1 && styles.rowLast]}
                  textStyle={styles.rowText}
                  onShare={() => share(invite)}
                  onRevoke={() => setRevoking(invite)}
                />
              ))}
            </View>
          ) : (
            <Text variant="small" tone="muted">
              {t('circles.invites.emptyCircle')}
            </Text>
          )}
        </>
      )}
    </BottomSheet>
  );
}

function InviteRow({
  invite,
  rowStyle,
  textStyle,
  onShare,
  onRevoke,
}: {
  invite: CircleInvite;
  rowStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<ViewStyle>;
  onShare: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const shortDate = useShortDate();
  const open = invite.status === 'active' && invite.code;
  const used = invite.status === 'redeemed' ? 1 : 0;
  return (
    <View style={rowStyle}>
      <View style={textStyle}>
        {open ? (
          // An invite code reads left to right in both languages.
          <Text variant="heading" selectable style={{ writingDirection: 'ltr', letterSpacing: 1, textAlign: 'left' }} accessibilityLabel={invite.code!.split('').join(' ')}>
            {formatInviteCode(invite.code!)}
          </Text>
        ) : (
          <Text variant="body" tone="muted">
            {t(`circles.invites.status.${invite.status}`)}
          </Text>
        )}
        {open ? (
          <Text variant="caption" tone="muted">
            {t('circles.invites.forCircle', { name: invite.circle?.name ?? '' })}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {[
            open ? t('circles.invites.until', { date: shortDate(invite.expiresAt.slice(0, 10) as LocalDate) }) : null,
            t('circles.invites.uses', { used, max: 1 }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      {open ? (
        <>
          <IconButton icon={Share2} label={t('circles.invites.share')} tone="link" bordered onPress={onShare} />
          <IconButton icon={XCircle} label={t('circles.invites.revoke')} tone="default" bordered onPress={onRevoke} />
        </>
      ) : null}
    </View>
  );
}
