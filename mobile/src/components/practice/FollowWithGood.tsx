/**
 * «أتبِع السيئة الحسنة» after «وقعت ثم تبت» (docs/plan/2026-10-tazkiya-tracker-proposals.md item 4): the istighfar line,
 * then «حسنة صغيرة الآن» (one of the catalog's choices; «فعلتها» keeps its key with the day's check-in, on this device
 * only), then a hopeful close. Every line is catalog content (`common.followWithGood`); the texts come from the API.
 * No reset and no blame: the stages of practice-core do not change.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import type { LocalDate, SinProgram } from '@thekra/practice-core';
import { pick, type FollowWithGood as FollowWithGoodContent, type StageContent } from '@/lib/practice/catalog-types';
import { usePracticeStore } from '@/lib/practice/practice-store';
import { withDeedAfterFall } from '@/lib/practice/sin-program-view';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import type { QuoteDto } from '@/lib/types/api';
import { EvidenceList } from '@/components/practice/EvidenceList';
import { space, useStyles } from '@/theme';
import { Button, CheckRow, Notice, Text } from '@/ui';

const FALL_STEPS = ['istighfar', 'deeds', 'close'] as const;
type FallStep = (typeof FALL_STEPS)[number];

interface IFollowWithGoodProps {
  program: SinProgram;
  date: LocalDate;
  flow: FollowWithGoodContent;
  /** «خربانة؟ صلّحها»: the heading and opening words of the flow. */
  intro: StageContent;
  evidenceById: Map<string, QuoteDto> | undefined;
  evidenceLoading: boolean;
  evidenceError: boolean;
  /** In the «لحظة الضعف» modal: «عودة» at the close. */
  onDone?: () => void;
}

const makeStyles = () => ({
  block: { gap: space.md },
  options: { gap: space.sm },
  done: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
});

export function FollowWithGood({ program, date, flow, intro, evidenceById, evidenceLoading, evidenceError, onDone }: IFollowWithGoodProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const locale = useUiLocale();
  const setStore = usePracticeStore((s) => s.setStore);
  const deedKey = program.checkIns.find((c) => c.date === date)?.deed;
  const [step, setStep] = useState<FallStep>(deedKey ? 'close' : 'istighfar');
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = flow.deeds.choices.find((c) => c.key === (deedKey ?? selected));
  const evidence = { byId: evidenceById, loading: evidenceLoading, error: evidenceError, limit: 1 };

  function handleDid() {
    if (!selected) return;
    setStore((s) => ({ ...s, programs: withDeedAfterFall(s.programs, program.sinSlug, date, selected) }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('close');
  }

  return (
    <View style={styles.block}>
      <Text variant="heading" tone="link" accessibilityRole="header">
        {pick(intro, 'title', locale)}
      </Text>
      <Text variant={locale === 'ar' ? 'reading' : 'body'}>{pick(intro, 'body', locale)}</Text>
      <Text variant="eyebrow">{t('sinProgram.urge.progress', { n: String(FALL_STEPS.indexOf(step) + 1), total: String(FALL_STEPS.length) })}</Text>

      {step === 'istighfar' ? (
        <View style={styles.block}>
          <Text variant="heading" accessibilityRole="header">
            {pick(flow.istighfar, 'title', locale)}
          </Text>
          <Text variant="title">{pick(flow.istighfar, 'line', locale)}</Text>
          <Text variant="body">{pick(flow.istighfar, 'body', locale)}</Text>
          <EvidenceList ids={flow.istighfar.evidence} {...evidence} />
          <Button label={t('sinProgram.urge.next')} onPress={() => setStep('deeds')} arrow />
        </View>
      ) : null}

      {step === 'deeds' ? (
        <View style={styles.block}>
          <Text variant="heading" accessibilityRole="header">
            {pick(flow.deeds, 'title', locale)}
          </Text>
          <Text variant="body">{pick(flow.deeds, 'body', locale)}</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {flow.deeds.choices.map((choice) => (
              <CheckRow
                key={choice.key}
                radio
                title={pick(choice, 'title', locale)}
                hint={choice.bodyAr ? pick(choice, 'body', locale) : undefined}
                checked={selected === choice.key}
                onPress={() => setSelected(choice.key)}
              />
            ))}
          </View>
          <EvidenceList ids={chosen?.evidence ?? flow.deeds.evidence} {...evidence} />
          <Button label={t('sinProgram.fall.did')} icon={Check} onPress={handleDid} disabled={!selected} large />
          <Button label={t('sinProgram.fall.later')} onPress={() => setStep('close')} variant="ghost" />
        </View>
      ) : null}

      {step === 'close' ? (
        <View style={styles.block}>
          {chosen && deedKey ? <Notice icon={Check}>{t('sinProgram.fall.deedDone', { deed: pick(chosen, 'title', locale) })}</Notice> : null}
          <Text variant="heading" accessibilityRole="header">
            {pick(flow.close, 'title', locale)}
          </Text>
          <Text variant={locale === 'ar' ? 'reading' : 'body'}>{pick(flow.close, 'body', locale)}</Text>
          <EvidenceList ids={flow.close.evidence} {...evidence} />
          {onDone ? <Button label={t('sinProgram.urge.back')} onPress={onDone} variant="outline" /> : null}
        </View>
      ) : null}
    </View>
  );
}
