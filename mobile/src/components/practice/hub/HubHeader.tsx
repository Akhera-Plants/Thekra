/**
 * The hub's title block: «عاداتي», the selected day under it in Hijri and Gregorian, and at the end the calendar and
 * «أضف» (a hairline ring, the page's one primary control).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Plus } from 'lucide-react-native';
import { space, useStyles } from '@/theme';
import { IconButton, Text } from '@/ui';

const makeStyles = () => ({
  root: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.xs },
  titles: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs, paddingTop: space.xs },
});

export interface HubHeaderProps {
  dateLabel: string;
  onCalendar: () => void;
  onAdd: () => void;
}

export function HubHeader({ dateLabel, onCalendar, onAdd }: HubHeaderProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.root}>
      <View style={styles.titles}>
        <Text variant="display" accessibilityRole="header">
          {t('practice.title')}
        </Text>
        <Text variant="small" tone="muted">
          {dateLabel}
        </Text>
      </View>
      <View style={styles.actions}>
        <IconButton icon={CalendarDays} label={t('calendar.title')} onPress={onCalendar} />
        <IconButton icon={Plus} label={t('practice.hub.add')} onPress={onAdd} tone="link" bordered />
      </View>
    </View>
  );
}
