/**
 * A saved loop as a clear visual card (owner round 3, item 17): the answered steps as stations on one line, each with
 * its short label and the member's words, and a closing station that returns to the start («وتعود الحلقة»); then
 * «عدّل» and «احذف» (confirmed). Used for «حلقة العادة» (plans) and «حلقة المعصية» (inside the locked program).
 */

import React from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pencil, Repeat, Trash } from 'lucide-react-native';
import type { HabitLoop, SinLoop } from '@thekra/practice-core';
import { loopLines, type LoopKind } from '@/lib/practice/loops';
import { radius, space, useStyles, type Theme } from '@/theme';
import { Button, Icon, Text } from '@/ui';

const DOT = 12;

const makeStyles = (t: Theme) => ({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.card },
  station: { flexDirection: 'row' as const, gap: space.md },
  rail: { width: DOT, alignItems: 'center' as const },
  dot: { width: DOT, height: DOT, marginTop: 7, borderRadius: radius.full, borderWidth: 2, borderColor: t.colors.primary, backgroundColor: t.colors.card },
  dotKey: { backgroundColor: t.colors.primary },
  line: { flex: 1, width: 2, backgroundColor: t.colors.primarySoft, marginTop: 2 },
  texts: { flex: 1, gap: 2, paddingBottom: space.md },
  back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, paddingStart: 0 },
  actions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
});

export interface LoopCardProps {
  kind: LoopKind;
  loop: HabitLoop | SinLoop;
  /** «الحلقة 1»… */
  title: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function LoopCard({ kind, loop, title, onEdit, onDelete }: LoopCardProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const lines = loopLines(kind, loop);
  // The station the loop turns on: the routine of a habit, the alternative of a sin.
  const key = kind === 'habit' ? 'routine' : 'alternative';

  function confirmDelete() {
    Alert.alert(t('loops.deleteTitle'), t('loops.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('loops.delete'), style: 'destructive', onPress: onDelete },
    ]);
  }

  return (
    <View style={styles.card}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <View>
        {lines.map((line) => (
          <View key={line.field} style={styles.station} accessible accessibilityLabel={`${t(`loops.${kind}.steps.${line.field}.label`)}: ${line.text}`}>
            <View style={styles.rail}>
              <View style={[styles.dot, line.field === key && styles.dotKey]} />
              <View style={styles.line} />
            </View>
            <View style={styles.texts}>
              <Text variant="caption" weight="medium" tone="link">
                {t(`loops.${kind}.steps.${line.field}.label`)}
              </Text>
              <Text variant="body">{line.text}</Text>
            </View>
          </View>
        ))}
        <View style={styles.back}>
          <Icon icon={Repeat} size={16} tone="link" />
          <Text variant="caption" tone="muted">
            {t(`loops.${kind}.again`)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label={t('loops.edit')} icon={Pencil} onPress={onEdit} variant="outline" size="sm" />
        <Button label={t('loops.delete')} icon={Trash} onPress={confirmDelete} variant="destructive" size="sm" />
      </View>
    </View>
  );
}
