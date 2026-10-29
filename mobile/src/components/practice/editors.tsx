/**
 * Editors shared by «أعِنّي على طاعة» and the plan screen (reminder slots, active days per week, reminder weekdays)
 * and the time field of the kinship and sin-program screens. Times are chosen with the system time picker
 * (TimePicker), stored as HH:MM and shown in the device's 12/24-hour style with Western digits.
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { useCalendars } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { Clock, Plus, X } from 'lucide-react-native';
import type { LocalTime } from '@thekra/practice-core';
import { displayTime, nowTime, sortSlots } from '@/lib/practice/format';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, Chip, ErrorText, Icon, Text, Wrap } from '@/ui';
import { TimePicker } from './TimePicker';

/** Saturday first, as the week reads in the Arab world. */
const WEEK = [6, 0, 1, 2, 3, 4, 5];
const ACTIVE_DAY_CHOICES = [2, 3, 4, 5, 6, 7];

const makeStyles = (t: Theme) => ({
  group: { gap: space.md },
  field: { gap: 6 },
  timeButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: t.colors.input,
    borderRadius: radius.control,
    backgroundColor: t.colors.card,
  },
  timeButtonPressed: { borderColor: t.colors.ring },
  slot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 48,
    paddingStart: space.lg,
    paddingEnd: space.md,
    borderRadius: radius.full,
    backgroundColor: t.colors.muted,
    borderWidth: 1,
    borderColor: t.colors.muted,
  },
  slotPressed: { borderColor: t.colors.ring },
});

/** HH:MM as this device shows times: «21:00», or «9:00 م» / «9:00 PM» where the clock is 12-hour. */
function useDisplayTime(): (time: LocalTime) => string {
  const { t } = useTranslation();
  const uses24hourClock = useCalendars()[0]?.uses24hourClock ?? true;
  return (time) => displayTime(time, uses24hourClock, { am: t('practice.time.am'), pm: t('practice.time.pm') });
}

export interface SlotsEditorProps {
  slots: LocalTime[];
  onChange: (slots: LocalTime[]) => void;
}

export function SlotsEditor({ slots, onChange }: SlotsEditorProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const show = useDisplayTime();
  // A new time opens on the last one chosen, else on the current hour.
  const start = slots[slots.length - 1] ?? `${nowTime().slice(0, 2)}:00`;

  return (
    <View style={styles.group}>
      <Text variant="small" tone="muted">
        {t('practice.add.slotsHint')}
      </Text>
      {slots.length > 0 ? (
        <Wrap>
          {slots.map((slot) => (
            <SlotChip key={slot} label={show(slot)} onRemove={() => onChange(slots.filter((x) => x !== slot))} />
          ))}
        </Wrap>
      ) : null}
      <TimePicker
        value={start}
        title={t('practice.add.slots')}
        onPick={(time) => onChange(sortSlots([...slots, time]))}
        renderTrigger={(open) => <Button label={t('practice.add.addSlot')} icon={Plus} onPress={open} variant="outline" />}
      />
      {slots.length === 0 ? <ErrorText>{t('practice.add.noSlots')}</ErrorText> : null}
      {slots.length === 1 ? (
        <Text variant="small" tone="muted">
          {t('practice.add.slotsOneWarning')}
        </Text>
      ) : null}
    </View>
  );
}

interface SlotChipProps {
  label: string;
  onRemove: () => void;
}

/** One reminder time; tapping it removes it. */
function SlotChip({ label, onRemove }: SlotChipProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onRemove}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={t('practice.add.removeSlot', { time: label })}
      style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
    >
      <Text variant="body">{label}</Text>
      <Icon icon={X} size={16} tone="muted" />
    </Pressable>
  );
}

export interface ActiveDaysPickerProps {
  value: number;
  onChange: (value: number) => void;
}

export function ActiveDaysPicker({ value, onChange }: ActiveDaysPickerProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      <Text variant="small" tone="muted">
        {t('practice.add.activeDaysHint')}
      </Text>
      <Wrap>
        {ACTIVE_DAY_CHOICES.map((n) => (
          <Chip key={n} label={t('practice.add.daysCount', { count: n })} selected={value === n} onPress={() => onChange(n)} />
        ))}
      </Wrap>
    </View>
  );
}

export interface WeekdayPickerProps {
  value: number[];
  onChange: (value: number[]) => void;
  /** One day only (kinship). */
  single?: boolean;
}

export function WeekdayPicker({ value, onChange, single }: WeekdayPickerProps) {
  const { t } = useTranslation();
  return (
    <Wrap>
      {WEEK.map((day) => {
        const selected = value.includes(day);
        return (
          <Chip
            key={day}
            label={t(`practice.weekdays.${day}`)}
            selected={selected}
            onPress={() => {
              if (single) onChange([day]);
              else onChange(selected ? value.filter((x) => x !== day) : [...value, day].sort());
            }}
          />
        );
      })}
    </Wrap>
  );
}

export interface TimeFieldProps {
  label: string;
  value: LocalTime;
  onChange: (time: LocalTime) => void;
}

/** A labelled time that opens the system time picker. */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const show = useDisplayTime();
  const shown = show(value);
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TimePicker
        value={value}
        title={label}
        onPick={onChange}
        renderTrigger={(open) => (
          <Pressable
            onPress={open}
            android_ripple={{ color: colors.accent }}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${shown}`}
            style={({ pressed }) => [styles.timeButton, pressed && styles.timeButtonPressed]}
          >
            <Text variant="body">{shown}</Text>
            <Icon icon={Clock} size={20} tone="muted" />
          </Pressable>
        )}
      />
    </View>
  );
}
