/**
 * The title block of «ورد اليوم»: the title and one date line (Gregorian; the Hijri date too when «إظهار التاريخ
 * الهجري» is on), and on the other side the streak chip (a green flame and the number, never red) and «أضف»
 * (outlined, on the title's line).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, Text } from '@/ui';
import { StreakFlame } from './StreakFlame';

const makeStyles = (t: Theme) => ({
  root: { gap: 2 },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
  /** Wraps rather than cut («Today's wi…» in English beside the streak and «أضف»). */
  title: { flex: 1, minWidth: 0 },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: t.colors.muted,
  },
});

export interface WirdHeaderProps {
  dateLabel: string;
  /** The current streak; null hides the chip (no habit yet). */
  streak: number | null;
  /** With a current streak of 0 after an earlier run: «ابدأ مداومة جديدة اليوم · أطول مداومة: N» instead of a 0. */
  freshLine?: string | null;
  onAdd: () => void;
}

export function WirdHeader({ dateLabel, streak, freshLine, onAdd }: WirdHeaderProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          {t('practice.wird.title')}
        </Text>
        {streak !== null && !freshLine ? (
          <View style={styles.chip} accessible accessibilityLabel={t('practice.wird.streakLabel', { count: streak })}>
            <StreakFlame size={18} />
            <Text variant="body" weight="semibold">
              {String(streak)}
            </Text>
          </View>
        ) : null}
        {/* Outlined (A-08): the page's solid is the day's own action, not «أضف». */}
        <Button label={t('practice.hub.add')} icon={Plus} onPress={onAdd} variant="outline" size="sm" />
      </View>
      <Text variant="small" tone="muted">
        {dateLabel}
      </Text>
      {freshLine ? (
        <View style={styles.top}>
          <StreakFlame size={16} />
          <Text variant="small">{freshLine}</Text>
        </View>
      ) : null}
    </View>
  );
}
