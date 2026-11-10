/**
 * «التزام شخصي» for one habit (owner round 4): the sheet opened from «التزاماتي» and from the habit's page. Its title is
 * the habit; a radio list of practice-core's deeds (`PLEDGE_DEED_INFO`, titled in the UI locale), «أتصدق بـ…» (with its
 * amount) and «نص أكتبه» (with its line). Each deed has a small «الدليل» button that opens a second sheet with the
 * evidence and its source; nothing of it is shown in the list. «احفظ» saves, closes and reports back
 * (`onDone(message)`); with a pledge already there, «احذف الالتزام» (confirmed) at the bottom removes it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PLEDGE_DEED_INFO, SADAQAH_EVIDENCE, type PledgeAction } from '@thekra/practice-core';
import { useEvidence } from '@/lib/api/practice';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { newPracticeId, today, usePracticeStore } from '@/lib/practice/practice-store';
import { draftReady, pledgeOfPlan, removePlanPledge, savePlanPledge, type PledgeDraft } from '@/lib/practice/pledges';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { ButtonPair, Field, MIN_TARGET, Text, toast, useConfirm } from '@/ui';
import { BottomSheet } from './mujahada/Sheet';

const makeStyles = (t: Theme) => ({
  /** No top rule: the first row sits under its section title (A-05). */
  list: {},
  item: { borderBottomWidth: 1, borderBottomColor: t.colors.border, paddingVertical: space.sm, gap: space.sm },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md },
  choice: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, minHeight: 44 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: t.colors.mutedForeground,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioOn: { borderColor: t.colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: t.colors.primary },
  label: { flex: 1 },
  evidenceButton: {
    minHeight: MIN_TARGET,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: t.colors.controlBorder,
    backgroundColor: t.colors.card,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  evidenceButtonPressed: { backgroundColor: t.colors.muted, borderColor: t.colors.ring },
  input: { paddingStart: 20 + space.md },
  quote: { gap: space.sm, paddingBottom: space.md },
});

/** How long the confirmation after a save or a removal stays. */
const DONE_MS = 3500;

/**
 * The confirmation shown by the sheet's caller after it closes (the app has no toast; the kit's `Notice` with a check is
 * the closest): the message, cleared after a few seconds.
 */
export function usePledgeDone(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), DONE_MS);
    return () => clearTimeout(timer);
  }, [message]);
  return [message, useCallback((m: string) => setMessage(m), [])];
}

interface Option {
  key: PledgeAction;
  title: string;
  /** Public Quote ids (read through the API); null for a custom line. */
  evidence: readonly string[] | null;
}

export interface PledgeSheetProps {
  visible: boolean;
  planId: string | null;
  /** The habit's name in the UI locale: the sheet's title. */
  habitTitle: string;
  onClose: () => void;
  /** After a save or a removal: the sheet is closed, the message is the caller's confirmation to show. */
  onDone: (message: string) => void;
}

export function PledgeSheet({ visible, planId, habitTitle, onClose, onDone }: PledgeSheetProps) {
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const heart = usePracticeStore((s) => s.heart);
  const setHeart = usePracticeStore((s) => s.setHeart);
  const current = planId ? pledgeOfPlan(heart, planId) : undefined;
  const [draft, setDraft] = useState<PledgeDraft | null>(null);
  const [evidence, setEvidence] = useState<Option | null>(null);

  // Each opening starts from the habit's stored pledge (or no choice yet).
  useEffect(() => {
    if (visible) setDraft(current ? { action: current.action, text: current.text ?? '' } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, planId]);

  const options: Option[] = [
    ...PLEDGE_DEED_INFO.map((d) => ({ key: d.key, title: locale === 'en' ? d.titleEn : d.titleAr, evidence: d.evidence })),
    { key: 'sadaqah', title: t('practice.notifyPrefs.pledgeSadaqah'), evidence: SADAQAH_EVIDENCE },
    { key: 'custom', title: t('practice.notifyPrefs.pledgeCustom'), evidence: null },
  ];

  function choose(key: PledgeAction) {
    setDraft((d) => ({ action: key, text: d && d.action === key ? d.text : key === current?.action ? current.text ?? '' : '' }));
  }

  function save() {
    if (!planId || !draftReady(draft)) return;
    setHeart((h) => savePlanPledge(h, planId, draft, today(), newPracticeId));
    onClose();
    onDone(t('practice.notifyPrefs.pledgeSaved', { habit: habitTitle }));
    toast(t('practice.notifyPrefs.pledgeSaved', { habit: habitTitle }));
  }

  function remove() {
    if (!planId) return;
    void confirm({
      title: t('practice.notifyPrefs.pledgeDelete'),
      message: t('practice.notifyPrefs.pledgeDeleteConfirm', { habit: habitTitle }),
      confirmLabel: t('common.delete'),
      tone: 'destructive',
    }).then((ok) => {
      if (!ok) return;
      setHeart((h) => removePlanPledge(h, planId));
      onClose();
      onDone(t('practice.notifyPrefs.pledgeDeleted', { habit: habitTitle }));
    });
  }

  return (
    <BottomSheet
      visible={visible}
      title={habitTitle}
      onClose={onClose}
      footer={
        <ButtonPair
          size="lg"
          primary={{ label: t('practice.notifyPrefs.pledgeSave'), onPress: save, disabled: !draftReady(draft) }}
          secondary={current ? { label: t('practice.notifyPrefs.pledgeDelete'), onPress: remove, variant: 'destructive' } : null}
        />
      }
    >
      <Text variant="label">{t('practice.notifyPrefs.pledgeIf')}</Text>
      <View style={styles.list} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = draft?.action === o.key;
          return (
            <View key={o.key} style={styles.item}>
              <View style={styles.row}>
                <Pressable
                  onPress={() => choose(o.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.title}
                  style={({ pressed }) => [styles.choice, pressed && { opacity: 0.7 }]}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  <Text variant="body" weight={on ? 'medium' : 'regular'} style={styles.label}>
                    {o.title}
                  </Text>
                </Pressable>
                {o.evidence ? <EvidenceButton label={t('practice.notifyPrefs.pledgeEvidence')} title={o.title} onPress={() => setEvidence(o)} /> : null}
              </View>
              {on && (o.key === 'sadaqah' || o.key === 'custom') ? (
                <Field
                  label={o.key === 'sadaqah' ? t('practice.notifyPrefs.pledgeAmount') : t('practice.notifyPrefs.pledgeText')}
                  value={draft?.text ?? ''}
                  maxLength={140}
                  onChangeText={(text) => setDraft({ action: o.key, text })}
                  containerStyle={styles.input}
                  autoFocus
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <EvidenceSheet option={evidence} onClose={() => setEvidence(null)} />
      {dialog}
    </BottomSheet>
  );
}

function EvidenceButton({ label, title, onPress }: { label: string; title: string; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      // «الدليل: <the deed>», never fourteen bare «الدليل» (A-19).
      accessibilityLabel={`${label}: ${title}`}
      style={({ pressed }) => [styles.evidenceButton, pressed && styles.evidenceButtonPressed]}
    >
      <Text variant="caption" weight="medium" tone="link">
        {label}
      </Text>
    </Pressable>
  );
}

/** The deed's evidence: published texts read from the API (as a habit's «المُعينات»), never typed here. */
function EvidenceSheet({ option, onClose }: { option: Option | null; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useUiLocale();
  const styles = useStyles(makeStyles);
  const ids = option?.evidence ?? [];
  const evidence = useEvidence(ids, locale);
  return (
    <BottomSheet visible={ids.length > 0} title={t('practice.notifyPrefs.pledgeEvidence')} onClose={onClose}>
      {ids.length > 0 ? (
        <View style={styles.quote}>
          <Text variant="small" tone="muted">
            {option?.title}
          </Text>
          <EvidenceList ids={ids} byId={evidence.data} loading={evidence.isLoading} error={evidence.isError} title="" />
        </View>
      ) : null}
    </BottomSheet>
  );
}
