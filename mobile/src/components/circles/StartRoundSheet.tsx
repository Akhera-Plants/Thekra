/**
 * «ابدأ جولة» (owner round 7, D5), after the owner's study group: «راوند جديدة لمدة 30د»، «جلسة مذاكرة compiler design
 * لمدة ساعة»، «مهمة لمدة 15د». What (a short list of kinds, «عادة» with today's habits as a shortcut, though any
 * label is fine), an optional short label (the only text a member types; 60 characters, cleaned again by the API)
 * and how long (15/25/30/45/60 or another number of minutes). The preview shows what the others will read. «الجولة n
 * اليوم» is counted by the API.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Timer } from 'lucide-react-native';
import { usePracticeCatalog } from '@/lib/api/practice';
import { useStartRound } from '@/lib/api/circles';
import { circleErrorKey, roundLine } from '@/lib/circles/circle-view';
import { today, usePracticeStore } from '@/lib/practice/practice-store';
import { useDayAgenda } from '@/lib/practice/use-habits-hub';
import { useUiLocale } from '@/lib/practice/use-practice-lifecycle';
import {
  ROUND_KINDS,
  ROUND_LABEL_MAX,
  ROUND_MINUTE_PRESETS,
  ROUND_MINUTES_MAX,
  type RoundKind,
  type StartRoundInput,
} from '@/lib/types/circles';
import { planTitleOf } from '@/components/practice/hub/HeartCards';
import { radius, space, useStyles, type Theme } from '@/theme';
import { BottomSheet, Button, Chip, ErrorText, Field, Icon, Text, Wrap, toast } from '@/ui';

export type RoundDraft = Pick<StartRoundInput, 'kind' | 'label' | 'minutes'>;

const DEFAULT_DRAFT: RoundDraft = { kind: 'study', minutes: 25 };

const makeStyles = (t: Theme) => ({
  group: { gap: space.sm },
  preview: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: t.colors.muted,
  },
});

/** Today's habits (never the sin program, which is not a plan) as label shortcuts for «عادة». */
function useHabitNames(): string[] {
  const locale = useUiLocale();
  const catalog = usePracticeCatalog(locale).data?.habits ?? [];
  const plans = usePracticeStore((s) => s.store.plans);
  const items = useDayAgenda(today());
  return useMemo(() => {
    const ids = new Set(items.filter((i) => i.kind === 'habit').map((i) => (i.kind === 'habit' ? i.planId : '')));
    return plans
      .filter((p) => ids.has(p.id))
      .map((p) => planTitleOf(p, catalog, locale).slice(0, ROUND_LABEL_MAX))
      .slice(0, 8);
  }, [catalog, items, locale, plans]);
}

export function StartRoundSheet({
  circleId,
  visible,
  initial,
  onClose,
}: {
  circleId: string;
  visible: boolean;
  /** «عدّل» after a round: the last round's what and time. */
  initial?: RoundDraft | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const start = useStartRound(circleId);
  const habitNames = useHabitNames();
  const [kind, setKind] = useState<RoundKind>(DEFAULT_DRAFT.kind);
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState<number>(DEFAULT_DRAFT.minutes);
  const [custom, setCustom] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // Each opening starts from the given draft (or the defaults).
  useEffect(() => {
    if (!visible) return;
    const draft = initial ?? DEFAULT_DRAFT;
    setKind(draft.kind);
    setLabel(draft.label ?? '');
    const preset = (ROUND_MINUTE_PRESETS as readonly number[]).includes(draft.minutes);
    setMinutes(draft.minutes);
    setIsCustom(!preset);
    setCustom(preset ? '' : String(draft.minutes));
    start.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on opening
  }, [visible]);

  const customMinutes = Number.parseInt(custom, 10);
  const chosen = isCustom ? customMinutes : minutes;
  const isValid = Number.isInteger(chosen) && chosen >= 1 && chosen <= ROUND_MINUTES_MAX;
  const trimmed = label.trim();

  const handleStart = () => {
    if (!isValid) return;
    start.mutate(
      { kind, label: trimmed.length > 0 ? trimmed : undefined, minutes: chosen, today: today() },
      {
        onSuccess: () => {
          toast(t('circles.round.started'));
          onClose();
        },
      },
    );
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('circles.round.sheetTitle')}
      onClose={onClose}
      footer={<Button label={t('circles.round.begin')} size="lg" onPress={handleStart} disabled={!isValid} loading={start.isPending} />}
    >
      <View style={styles.group}>
        <Text variant="label">{t('circles.round.kindLabel')}</Text>
        <Wrap>
          {ROUND_KINDS.map((k) => (
            <Chip key={k} label={t(`circles.round.kinds.${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </Wrap>
      </View>
      <View style={styles.group}>
        <Field
          label={t('circles.round.labelLabel')}
          hint={t('circles.round.labelHint')}
          value={label}
          onChangeText={setLabel}
          maxLength={ROUND_LABEL_MAX}
          returnKeyType="done"
        />
        {kind === 'habit' && habitNames.length > 0 ? (
          <>
            <Text variant="caption" tone="muted">
              {t('circles.round.fromHabits')}
            </Text>
            <Wrap>
              {habitNames.map((name) => (
                <Chip key={name} label={name} selected={trimmed === name} onPress={() => setLabel(name)} />
              ))}
            </Wrap>
          </>
        ) : null}
      </View>
      <View style={styles.group}>
        <Text variant="label">{t('circles.round.minutesLabel')}</Text>
        <Wrap>
          {ROUND_MINUTE_PRESETS.map((m) => (
            <Chip
              key={m}
              label={t('circles.round.minutes', { count: m })}
              selected={!isCustom && minutes === m}
              onPress={() => {
                setIsCustom(false);
                setMinutes(m);
              }}
            />
          ))}
          <Chip label={t('circles.round.custom')} selected={isCustom} onPress={() => setIsCustom(true)} />
        </Wrap>
        {isCustom ? (
          <Field
            label={t('circles.round.customLabel')}
            hint={t('circles.round.customHint')}
            value={custom}
            onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, '').slice(0, 3))}
            keyboardType="number-pad"
            inputMode="numeric"
            dir="ltr"
            autoFocus
          />
        ) : null}
      </View>
      {isValid ? (
        <View style={styles.preview}>
          <Icon icon={Timer} size={18} tone="link" />
          <Text variant="small" style={{ flex: 1 }}>
            {t('circles.round.preview', { text: roundLine(t, { kind, label: trimmed || null, minutes: chosen }) })}
          </Text>
        </View>
      ) : null}
      {start.isError ? <ErrorText>{t(circleErrorKey(start.error))}</ErrorText> : null}
    </BottomSheet>
  );
}
