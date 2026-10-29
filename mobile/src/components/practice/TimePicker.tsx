/**
 * The system time picker (@react-native-community/datetimepicker), as its README recommends per platform:
 * Android opens the system dialog through the imperative `DateTimePickerAndroid`; iOS shows the wheel in a bottom
 * sheet with Cancel and Done. Both follow the device's 12/24-hour setting; the value stays HH:MM.
 * The library has no web picker: on the web build the trigger does nothing.
 */

import React, { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { LocalTime } from '@thekra/practice-core';
import { nowTime, timeToDate } from '@/lib/practice/format';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, Text } from '@/ui';

const makeStyles = (t: Theme) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end' as const, backgroundColor: t.colors.overlay },
  sheet: {
    backgroundColor: t.colors.card,
    borderTopStartRadius: radius.card,
    borderTopEndRadius: radius.card,
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: space.md },
  title: { flex: 1 },
  wheel: { alignSelf: 'center' as const },
});

export interface TimePickerProps {
  /** The time the picker opens on. */
  value: LocalTime;
  onPick: (time: LocalTime) => void;
  /** Names the sheet on iOS (the field's label). */
  title: string;
  /** The control that opens the picker. */
  renderTrigger: (open: () => void) => React.ReactNode;
}

export function TimePicker({ value, onPick, title, renderTrigger }: TimePickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: timeToDate(value), mode: 'time', onValueChange: (_event, date) => onPick(nowTime(date)) });
      return;
    }
    if (Platform.OS === 'ios') setSheetOpen(true);
  }

  return (
    <>
      {renderTrigger(open)}
      {Platform.OS === 'ios' ? (
        <TimeSheet
          visible={sheetOpen}
          value={value}
          title={title}
          onDone={(time) => {
            setSheetOpen(false);
            onPick(time);
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </>
  );
}

interface TimeSheetProps {
  visible: boolean;
  value: LocalTime;
  title: string;
  onDone: (time: LocalTime) => void;
  onClose: () => void;
}

/** iOS: the wheel in a sheet; the choice counts only on Done. */
function TimeSheet({ visible, value, title, onDone, onClose }: TimeSheetProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => timeToDate(value));

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={() => setDraft(timeToDate(value))} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
            <Text variant="small" weight="medium" align="center" numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <Button label={t('common.done')} onPress={() => onDone(nowTime(draft))} />
          </View>
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            themeVariant={dark ? 'dark' : 'light'}
            onValueChange={(_event, date) => setDraft(date)}
            style={styles.wheel}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
