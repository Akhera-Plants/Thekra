/**
 * Report abuse (owner round 7, D8: «أهم إشي في الصحبة … الإبلاغ عن إساءة من عضو معين أو رسالة معينة»): a member or one
 * message, a reason, an optional note. The report reaches the owner of Thekra only and removes nothing by itself; a
 * reported message leaves the reporter's own feed, and «أخفِ رسائله عني» (on by default for a member) hides the
 * member's messages from them at once. No one is told.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useReport } from '@/lib/api/circles';
import { circleErrorKey } from '@/lib/circles/circle-view';
import { REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason } from '@/lib/types/circles';
import { space } from '@/theme';
import { BottomSheet, ButtonPair, Chip, ErrorText, Field, SwitchRow, Text, Wrap, toast } from '@/ui';

export type ReportTarget =
  | { kind: 'member'; memberId: string; name: string }
  | { kind: 'message'; messageId: string; memberId: string; name: string };

export function ReportSheet({ circleId, target, onClose }: { circleId: string; target: ReportTarget | null; onClose: () => void }) {
  const { t } = useTranslation();
  const report = useReport(circleId);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [mute, setMute] = useState(false);

  useEffect(() => {
    if (!target) return;
    setReason(null);
    setNote('');
    setMute(target.kind === 'member');
    report.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new target opens
  }, [target]);

  const handleSubmit = () => {
    if (!target || !reason) return;
    const trimmed = note.trim();
    report.mutate(
      {
        kind: target.kind,
        ...(target.kind === 'member' ? { memberId: target.memberId } : { messageId: target.messageId }),
        reason,
        note: trimmed.length > 0 ? trimmed : undefined,
        mute,
      },
      {
        onSuccess: () => {
          toast(t(mute ? 'circles.report.sentMuted' : 'circles.report.sent'));
          onClose();
        },
      },
    );
  };

  const title = target?.kind === 'member' ? t('circles.report.memberTitle', { name: target.name }) : t('circles.report.messageTitle');
  return (
    <BottomSheet
      visible={target !== null}
      title={title}
      onClose={onClose}
      footer={
        <ButtonPair
          size="lg"
          primary={{ label: t('circles.report.submit'), onPress: handleSubmit, disabled: reason === null, loading: report.isPending }}
          secondary={{ label: t('common.cancel'), onPress: onClose }}
        />
      }
    >
      <Text variant="small" tone="muted">
        {t('circles.report.lead')}
      </Text>
      <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={t('circles.report.reasonLabel')}>
        <Text variant="label">{t('circles.report.reasonLabel')}</Text>
        <Wrap>
          {REPORT_REASONS.map((r) => (
            <Chip key={r} label={t(`circles.report.reasons.${r}`)} selected={reason === r} onPress={() => setReason(r)} />
          ))}
        </Wrap>
      </View>
      <Field
        label={t('circles.report.noteLabel')}
        hint={t('circles.report.noteHint')}
        value={note}
        onChangeText={setNote}
        maxLength={REPORT_NOTE_MAX}
        multiline
        style={{ minHeight: 88, textAlignVertical: 'top' }}
      />
      {target ? (
        <SwitchRow
          label={t('circles.report.mute')}
          hint={t('circles.report.muteHint')}
          value={mute}
          onValueChange={setMute}
        />
      ) : null}
      {report.isError ? <ErrorText>{t(circleErrorKey(report.error))}</ErrorText> : null}
    </BottomSheet>
  );
}
