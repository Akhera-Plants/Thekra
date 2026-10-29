/**
 * Editors shared by «أعِنّي على طاعة» and the plan screen (reminder slots, active days per week, reminder weekdays)
 * and the time field of the kinship and sin-program screens. Times are typed as HH:MM in Western digits and read
 * left to right in both directions.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react-native';
import type { LocalTime } from '@thekra/practice-core';
import { normalizeTimeInput, sortSlots } from '@/lib/practice/format';
import { radius, space, useStyles, useTheme, type Theme } from '@/theme';
import { Button, Chip, ErrorText, Field, Icon, Text, Wrap } from '@/ui';

/** Saturday first, as the week reads in the Arab world. */
const WEEK = [6, 0, 1, 2, 3, 4, 5];
const ACTIVE_DAY_CHOICES = [2, 3, 4, 5, 6, 7];

const makeStyles = (t: Theme) => ({
  group: { gap: space.md },
  addRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: space.sm },
  addField: { flex: 1 },
  time: { writingDirection: 'ltr' as const, textAlign: 'center' as const },
  slot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    minHeight: 44,
    paddingStart: space.lg,
    paddingEnd: space.md,
    borderRadius: radius.full,
    backgroundColor: t.colors.muted,
    borderWidth: 1,
    borderColor: t.colors.muted,
  },
  slotPressed: { borderColor: t.colors.ring },
  slotTime: { writingDirection: 'ltr' as const },
});

export interface SlotsEditorProps {
  slots: LocalTime[];
  onChange: (slots: LocalTime[]) => void;
}

export function SlotsEditor({ slots, onChange }: SlotsEditorProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const time = normalizeTimeInput(draft);
    if (!time) {
      setError(t('practice.add.invalidTime'));
      return;
    }
    setError(null);
    setDraft('');
    onChange(sortSlots([...slots, time]));
  }

  return (
    <View style={styles.group}>
      <Text variant="small" tone="muted">
        {t('practice.add.slotsHint')}
      </Text>
      {slots.length > 0 ? (
        <Wrap>
          {slots.map((slot) => (
            <SlotChip key={slot} time={slot} onRemove={() => onChange(slots.filter((x) => x !== slot))} />
          ))}
        </Wrap>
      ) : null}
      <View style={styles.addRow}>
        <View style={styles.addField}>
          <Field
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              if (error) setError(null);
            }}
            placeholder={t('practice.add.slotPlaceholder')}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            autoComplete="off"
            autoCorrect={false}
            onSubmitEditing={handleAdd}
            accessibilityLabel={t('practice.add.slots')}
            maxLength={5}
            error={error}
            style={styles.time}
          />
        </View>
        <Button label={t('practice.add.addSlot')} icon={Plus} onPress={handleAdd} variant="outline" />
      </View>
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
  time: LocalTime;
  onRemove: () => void;
}

/** One reminder time; tapping it removes it. */
function SlotChip({ time, onRemove }: SlotChipProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onRemove}
      hitSlop={4}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={t('practice.add.removeSlot', { time })}
      style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
    >
      <Text variant="body" style={styles.slotTime}>
        {time}
      </Text>
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
          <Chip key={n} label={t('practice.add.daysCount', { n: String(n) })} selected={value === n} onPress={() => onChange(n)} />
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

/** HH:MM field; accepts Arabic-Indic digits and «9.30»; reports only valid times. */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  return (
    <Field
      label={label}
      value={draft}
      onChangeText={(text) => {
        setDraft(text);
        const time = normalizeTimeInput(text);
        setInvalid(!time);
        if (time) onChange(time);
      }}
      keyboardType="numbers-and-punctuation"
      returnKeyType="done"
      autoComplete="off"
      autoCorrect={false}
      maxLength={5}
      error={invalid ? t('practice.add.invalidTime') : null}
      style={styles.time}
    />
  );
}
