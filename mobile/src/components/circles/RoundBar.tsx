/**
 * My round in this صحبة (owner round 7, D5): while it runs, what and how long, «الجولة n اليوم», when it ends, and
 * the two endings side by side («تم الحمد لله» solid, «لم يتم» outlined). Right after «تم», «جولة جديدة؟» offers the
 * same round in one tap («ابدأ مثلها») or the sheet with it filled in («عدّل»).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Timer, X } from 'lucide-react-native';
import { useDisplayTime } from '@/components/practice/editors';
import { circleErrorKey, roundLine } from '@/lib/circles/circle-view';
import { nowTime } from '@/lib/practice/format';
import type { CircleRound } from '@/lib/types/circles';
import { radius, space, useStyles, type Theme } from '@/theme';
import { ButtonPair, ErrorText, Icon, IconButton, Text } from '@/ui';
import type { RoundDraft } from './StartRoundSheet';

const makeStyles = (t: Theme) => ({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: t.colors.ring,
    backgroundColor: t.colors.card,
  },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  text: { flex: 1, minWidth: 0, gap: 2 },
});

export function RunningRound({
  round,
  onEnd,
  pending,
  error,
}: {
  round: CircleRound;
  onEnd: (outcome: 'done' | 'not_done') => void;
  pending: boolean;
  error: unknown;
}) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const displayTime = useDisplayTime();
  const isOver = Date.parse(round.endsAt) <= Date.now();
  const when = isOver ? t('circles.round.timeUp') : t('circles.round.endsAt', { time: displayTime(nowTime(new Date(round.endsAt))) });
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.head}>
        <Icon icon={Timer} size={22} tone="link" />
        <View style={styles.text}>
          <Text variant="eyebrow">{t('circles.round.yours')}</Text>
          <Text variant="body" weight="medium">
            {roundLine(t, round)}
          </Text>
          <Text variant="caption" tone="muted">
            {`${t('circles.round.number', { number: round.number })} · ${when}`}
          </Text>
        </View>
      </View>
      <ButtonPair
        primary={{ label: t('circles.round.done'), onPress: () => onEnd('done'), disabled: pending }}
        secondary={{ label: t('circles.round.notDone'), onPress: () => onEnd('not_done'), disabled: pending }}
      />
      {error ? <ErrorText>{t(circleErrorKey(error))}</ErrorText> : null}
    </View>
  );
}

export function AnotherRound({
  last,
  onSame,
  onEdit,
  onDismiss,
  pending,
}: {
  last: RoundDraft;
  onSame: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.text}>
          <Text variant="heading">{t('circles.round.againTitle')}</Text>
          <Text variant="small" tone="muted">
            {roundLine(t, { kind: last.kind, label: last.label ?? null, minutes: last.minutes })}
          </Text>
        </View>
        <IconButton icon={X} label={t('circles.round.dismiss')} onPress={onDismiss} />
      </View>
      <ButtonPair
        primary={{ label: t('circles.round.againSame'), onPress: onSame, loading: pending }}
        secondary={{ label: t('circles.round.againEdit'), onPress: onEdit }}
      />
    </View>
  );
}
