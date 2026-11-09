/**
 * «دعواتي» (round 6, C-01k): رفقة is invite-only, and a member whose رفقة is on can invite a few people. The line of
 * what is left (`remaining`, both limits applied, and how long an invite works), «أنشئ دعوة» (a one-use code that
 * expires), then my invites: an active one shows its code with «شارك» and, in «⋯», «ألغِ الدعوة» (confirmed); a used,
 * cancelled or expired one shows its state only. The inviter never learns who used an invite.
 */

import React from 'react';
import { Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Share2, Ticket, XCircle } from 'lucide-react-native';
import { CircleListSkeleton, CirclesSignedOut } from '@/components/circles/CircleStates';
import { useCircleAccess, useCircleUserId, useCreateInvite, useMyInvites, useRevokeInvite } from '@/lib/api/circles';
import { circleErrorKey, formatInviteCode, personalInviteLink } from '@/lib/circles/circle-view';
import { shortDate } from '@/lib/practice/format';
import type { LocalDate } from '@thekra/practice-core';
import type { CircleInvite } from '@/lib/types/circles';
import { space, useStyles, type Theme } from '@/theme';
import { ActionMenu, Button, EmptyState, ErrorState, ErrorText, Icon, IconButton, PageHeader, Screen, Section, Text, toast } from '@/ui';

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 64,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
});

export default function InvitesScreen() {
  const { t } = useTranslation();
  const userId = useCircleUserId();
  const access = useCircleAccess();
  const enabled = access.data?.enabled ?? false;
  const invites = useMyInvites(enabled);
  const create = useCreateInvite();
  const limits = access.data?.invites ?? null;

  function handleCreate() {
    create.mutate(undefined, {
      onSuccess: (invite) => {
        toast(t('circles.invites.created'));
        if (invite.code) void shareInvite(invite.code, t);
      },
    });
  }

  return (
    <Screen edges={['bottom']} refreshing={invites.isRefetching} onRefresh={() => void Promise.all([access.refetch(), invites.refetch()])}>
      <PageHeader title={t('circles.invites.title')} lead={t('circles.invites.lead')} />
      {!userId ? (
        <CirclesSignedOut />
      ) : access.isPending ? (
        <CircleListSkeleton />
      ) : access.isError ? (
        <ErrorState message={t(circleErrorKey(access.error))} onRetry={() => void access.refetch()} />
      ) : !enabled ? (
        <EmptyState icon={Ticket} message={t('circles.errors.notEnabled')} />
      ) : (
        <>
          <View style={{ gap: space.sm }}>
            {limits ? (
              <Text variant="small" tone="muted">
                {limits.remaining > 0
                  ? t('circles.invites.remaining', { count: limits.remaining, days: limits.ttlDays })
                  : t('circles.invites.none', { days: limits.periodDays })}
              </Text>
            ) : null}
            <Button
              label={t('circles.invites.create')}
              icon={Plus}
              size="lg"
              block
              onPress={handleCreate}
              loading={create.isPending}
              disabled={(limits?.remaining ?? 0) <= 0}
            />
            {create.isError ? <ErrorText>{t(circleErrorKey(create.error))}</ErrorText> : null}
          </View>
          <Section title={t('circles.invites.mine')}>
            {invites.isPending ? (
              <CircleListSkeleton />
            ) : invites.isError ? (
              <ErrorState message={t(circleErrorKey(invites.error))} onRetry={() => void invites.refetch()} />
            ) : invites.data.length === 0 ? (
              <Text variant="small" tone="muted">
                {t('circles.invites.empty')}
              </Text>
            ) : (
              <View>
                {invites.data.map((invite, i) => (
                  <InviteRow key={invite.id} invite={invite} last={i === invites.data.length - 1} />
                ))}
              </View>
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}

async function shareInvite(code: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const message = t('circles.invites.shareMessage', { code: formatInviteCode(code), link: personalInviteLink(code) });
  try {
    await Share.share({ message });
  } catch {
    // Dismissed: nothing to say.
  }
}

function InviteRow({ invite, last }: { invite: CircleInvite; last: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const revoke = useRevokeInvite();
  const active = invite.status === 'active' && invite.code;
  const until = shortDate(invite.expiresAt.slice(0, 10) as LocalDate);
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Icon icon={active ? Ticket : XCircle} size={22} tone={active ? 'link' : 'muted'} />
      <View style={styles.rowText}>
        {active ? (
          <Text variant="heading" selectable style={{ writingDirection: 'ltr', letterSpacing: 1 }} accessibilityLabel={invite.code!.split('').join(' ')}>
            {formatInviteCode(invite.code!)}
          </Text>
        ) : (
          <Text variant="body" tone="muted">
            {t(`circles.invites.status.${invite.status}`)}
          </Text>
        )}
        <Text variant="caption" tone="muted">
          {active ? t('circles.invites.until', { date: until }) : invite.circle ? invite.circle.name : ''}
        </Text>
        {revoke.isError ? <ErrorText>{t(circleErrorKey(revoke.error))}</ErrorText> : null}
      </View>
      {active ? (
        <>
          <IconButton icon={Share2} label={t('circles.shareInvite')} onPress={() => void shareInvite(invite.code!, t)} />
          <ActionMenu
            items={[
              {
                label: t('circles.invites.revoke'),
                destructive: true,
                onPress: () => revoke.mutate(invite.id, { onSuccess: () => toast(t('circles.invites.revoked')) }),
                confirm: { title: t('circles.invites.revokeTitle'), message: t('circles.invites.revokeBody'), confirmLabel: t('circles.invites.revoke') },
              },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}
