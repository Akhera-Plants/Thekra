/**
 * The hub's title block, after the website's HubHeader: «عاداتي» with the selected day under it (weekday and Hijri
 * date, then the Gregorian date in the muted ink), and at the end the calendar and «أضف», the page's one solid
 * control (the site's `.solid-button` with its plus).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Plus } from 'lucide-react-native';
import { space, useStyles } from '@/theme';
import { Button, IconButton, Text } from '@/ui';

/** `dayTitle` joins the Hijri and the Gregorian parts with this mark. */
const DATE_JOIN = ' · ';

const makeStyles = () => ({
  root: { gap: 2 },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.xs },
  title: { flex: 1 },
});

export interface HubHeaderProps {
  dateLabel: string;
  onCalendar: () => void;
  onAdd: () => void;
}

export function HubHeader({ dateLabel, onCalendar, onAdd }: HubHeaderProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const cut = dateLabel.indexOf(DATE_JOIN);
  const day = cut < 0 ? dateLabel : dateLabel.slice(0, cut);
  const gregorian = cut < 0 ? null : dateLabel.slice(cut);
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text variant="display" accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {t('practice.title')}
        </Text>
        <IconButton icon={CalendarDays} label={t('calendar.title')} onPress={onCalendar} />
        <Button label={t('practice.hub.add')} icon={Plus} onPress={onAdd} />
      </View>
      <Text variant="small">
        {day}
        {gregorian ? (
          <Text variant="small" tone="muted">
            {gregorian}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}
