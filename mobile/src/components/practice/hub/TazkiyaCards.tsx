/**
 * The hub's tazkiya cards (docs/plan/2026-10-tazkiya-tracker-proposals.md items 5 and 6), presentational only:
 * - «نيّتي اليوم»: pick one of today's habits, an optional short line, save or «ليس الآن»;
 * - «محاسبة المساء»: the catalog's intro, the one-tap «الحمد لله على ما كان», «اكتب محاسبتك», «ليس الآن»;
 * - the fresh-start card: a quiet next-step note with «جدّد نيّتك» and «زِد خطوة» or «ابدأ عادة صغيرة».
 * Every guidance word comes from the catalog; the buttons' chrome from i18n. No counters, no streaks.
 */

import React, { memo, useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MoonStar, Sun } from 'lucide-react-native';
import { NIYYAH_NOTE_MAX } from '@thekra/practice-core';
import { space, useStyles } from '@/theme';
import { Button, Card, Chip, Field, Icon, NextStep, Text, Wrap } from '@/ui';

const makeStyles = () => ({
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  actions: { marginTop: space.xs },
});

function CardHead({ icon, title }: { icon: typeof Sun; title: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.head}>
      <Icon icon={icon} size={20} tone="link" strokeWidth={1.5} />
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

export interface NiyyahChoice {
  planId: string;
  title: string;
}

const HabitChoice = memo(function HabitChoice({
  choice,
  selected,
  onSelect,
}: {
  choice: NiyyahChoice;
  selected: boolean;
  onSelect: (planId: string) => void;
}) {
  const handlePress = useCallback(() => onSelect(choice.planId), [onSelect, choice.planId]);
  return <Chip label={choice.title} selected={selected} onPress={handlePress} />;
});

export interface NiyyahCardProps {
  intro: string;
  choices: NiyyahChoice[];
  onSave: (choice: NiyyahChoice, note: string) => void;
  onNotNow: () => void;
}

/** «نيّتي اليوم»: about ten seconds, one tap on a habit and «احفظ نيّتي». */
export function NiyyahCard({ intro, choices, onSave, onNotNow }: NiyyahCardProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [planId, setPlanId] = useState<string | null>(choices.length === 1 ? (choices[0]?.planId ?? null) : null);
  const [note, setNote] = useState('');
  const chosen = choices.find((c) => c.planId === planId);
  const handleSave = useCallback(() => {
    if (chosen) onSave(chosen, note);
  }, [chosen, note, onSave]);

  return (
    <Card>
      <CardHead icon={Sun} title={t('tazkiya.niyyahTitle')} />
      <Text variant="small" tone="muted">
        {intro}
      </Text>
      <Wrap>
        {choices.map((choice) => (
          <HabitChoice key={choice.planId} choice={choice} selected={choice.planId === planId} onSelect={setPlanId} />
        ))}
      </Wrap>
      {chosen ? (
        <Field
          label={t('tazkiya.niyyahNoteLabel')}
          value={note}
          onChangeText={setNote}
          maxLength={NIYYAH_NOTE_MAX}
          returnKeyType="done"
          autoComplete="off"
          textContentType="none"
          onSubmitEditing={handleSave}
        />
      ) : null}
      <Wrap style={styles.actions}>
        <Button label={t('tazkiya.niyyahSave')} onPress={handleSave} disabled={!chosen} />
        <Button label={t('tazkiya.notNow')} onPress={onNotNow} variant="ghost" />
      </Wrap>
    </Card>
  );
}

export interface EveningCardProps {
  intro: string;
  thanks: string;
  onThanks: () => void;
  onWrite: () => void;
  onNotNow: () => void;
}

/** «محاسبة المساء» on the hub: the questions open on their own page; the thanks closes the evening in one tap. */
export function EveningCard({ intro, thanks, onThanks, onWrite, onNotNow }: EveningCardProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <Card>
      <CardHead icon={MoonStar} title={t('tazkiya.eveningTitle')} />
      <Text variant="small" tone="muted">
        {intro}
      </Text>
      <Wrap style={styles.actions}>
        <Button label={t('tazkiya.eveningWrite')} onPress={onWrite} arrow />
        <Button label={thanks} onPress={onThanks} variant="outline" />
        <Button label={t('tazkiya.notNow')} onPress={onNotNow} variant="ghost" />
      </Wrap>
    </Card>
  );
}

export interface FreshStartCardProps {
  title: string;
  body: string;
  /** «جدّد نيّتك»: opens the intention when today has a habit and no intention yet. */
  renewLabel: string;
  onRenew?: () => void;
  /** «زِد خطوة» or «ابدأ عادة صغيرة», when the day offers one. */
  stepLabel?: string;
  onStep?: () => void;
  onNotNow: () => void;
}

/** A quiet fresh start (Hijri month, Friday, Monday, the ten days, Sha'ban): one note, never a notification. */
export function FreshStartCard({ title, body, renewLabel, onRenew, stepLabel, onStep, onNotNow }: FreshStartCardProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <NextStep title={title}>
      <Text variant="small">{body}</Text>
      {onRenew ? null : (
        <Text variant="small" weight="medium" tone="link">
          {renewLabel}
        </Text>
      )}
      <Wrap style={styles.actions}>
        {onRenew ? <Button label={renewLabel} onPress={onRenew} variant="outline" /> : null}
        {stepLabel && onStep ? <Button label={stepLabel} onPress={onStep} variant="outline" arrow /> : null}
        <Button label={t('tazkiya.notNow')} onPress={onNotNow} variant="ghost" />
      </Wrap>
    </NextStep>
  );
}
