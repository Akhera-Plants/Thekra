/**
 * «أبلغ عن خطأ» (after the website's ReportMistakeDialog; round 6, C-01s): a sheet with the reason (one of five), an
 * optional note (at most 400 characters), «أرسل البلاغ» beside «إلغاء»; after sending, a thank-you and «تم» in the same
 * sheet. Only the text's id, the reason and the note are sent (no program, no plan). The endpoint is abuse-limited: a
 * refusal (too many reports, reports paused for the day, a note too long) is said kindly (`reportErrorKey`).
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react-native';
import { REPORT_NOTE_MAX, REPORT_REASONS, reportQuote, type ReportReason } from '@/lib/api/quotes';
import { reportErrorKey } from '@/lib/share/report-error';
import { space } from '@/theme';
import { BottomSheet, Button, ButtonPair, CheckRow, ErrorText, Field, Icon, Text } from '@/ui';

export function ReportMistakeSheet({ quoteId, visible, onClose }: { quoteId: string; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>('TEXT');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function close() {
    onClose();
    // A fresh form the next time it opens.
    setSent(false);
    setNote('');
    setReason('TEXT');
    setFailure(null);
  }

  async function send() {
    setPending(true);
    setFailure(null);
    try {
      await reportQuote(quoteId, reason, note);
      setSent(true);
    } catch (error) {
      setFailure(t(reportErrorKey(error)));
    } finally {
      setPending(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title={sent ? t('report.thanksTitle') : t('report.title')}
      onClose={close}
      footer={
        sent ? (
          <Button label={t('report.done')} size="lg" block onPress={close} />
        ) : (
          <ButtonPair
            size="lg"
            primary={{ label: t('report.send'), onPress: () => void send(), loading: pending, disabled: note.length > REPORT_NOTE_MAX }}
            secondary={{ label: t('common.cancel'), onPress: close }}
          />
        )
      }
    >
      {sent ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <Icon icon={CheckCircle2} size={20} tone="link" />
          <Text variant="body" style={{ flex: 1 }}>
            {t('report.sent')}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="small" tone="muted">
            {t('report.lead')}
          </Text>
          <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={t('report.reason')}>
            {REPORT_REASONS.map((r) => (
              <CheckRow key={r} radio title={t(`report.reasons.${r}`)} checked={reason === r} onPress={() => setReason(r)} />
            ))}
          </View>
          <Field
            label={t('report.note')}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={REPORT_NOTE_MAX}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
          {failure ? <ErrorText>{failure}</ErrorText> : null}
        </>
      )}
    </BottomSheet>
  );
}
