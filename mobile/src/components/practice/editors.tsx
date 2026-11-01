/**
 * Editors shared by «أعِنّي على طاعة» and the plan screen (reminder slots, active days per week, reminder weekdays)
 * and the time field of the kinship and sin-program screens. Times are chosen with the system time picker
 * (TimePicker), stored as HH:MM and shown in the device's 12/24-hour style with Western digits.
 * Slots follow the deed's time window (owner, 2026-11-01): only its anchors, only fixed times inside it, the window in
 * one line; a slot chosen before that does not suit is marked so it can be removed (`deed-window.ts`).
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { useCalendars } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { Clock, Plus, TriangleAlert, X } from 'lucide-react-native';
import {
  ANCHOR_LABELS,
  isPrayerAnchor,
  isTimeInWindow,
  orderedSlots,
  resolveAnchor,
  type DeedWindow,
  type LocalTime,
  type PrayerAnchor,
} from '@thekra/practice-core';
import { isChoiceSuitable, offeredAnchors, pickerStart, windowRange, type SlotChoice } from '@/lib/practice/deed-window';
import { currentPrayerDay } from '@/lib/practice/prayer';
import { today } from '@/lib/practice/practice-store';
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
  /** A slot chosen before the deed's window was known that does not suit it. */
  slotOff: { backgroundColor: t.colors.card, borderColor: t.colors.destructive },
  windowLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm },
});

/** HH:MM as this device shows times: «21:00», or «9:00 م» / «9:00 PM» where the clock is 12-hour. */
export function useDisplayTime(): (time: LocalTime) => string {
  const { t } = useTranslation();
  const uses24hourClock = useCalendars()[0]?.uses24hourClock ?? true;
  return (time) => displayTime(time, uses24hourClock, { am: t('practice.time.am'), pm: t('practice.time.pm') });
}

export type { SlotChoice } from '@/lib/practice/deed-window';

/** Choices ordered by the time they ring by default, without duplicates. */
export function sortChoices(choices: readonly SlotChoice[]): SlotChoice[] {
  const { slots, slotAnchors } = orderedSlots(choices);
  return slots.map((time, i) => slotAnchors?.[i] ?? time);
}

export interface SlotsEditorProps {
  slots: SlotChoice[];
  onChange: (slots: SlotChoice[]) => void;
  /** The deed's time window: only its anchors and the times inside it are offered. */
  window?: DeedWindow;
}

/**
 * Reminder slots: the prayer anchors that suit the deed first («بعد الفجر»…, resolved from «أوقات الصلاة», default
 * times otherwise), then «وقت أختاره» to add a fixed time inside the deed's window. Tapping a chosen time removes it.
 */
export function SlotsEditor({ slots, onChange, window }: SlotsEditorProps) {
  const { t, i18n } = useTranslation();
  const styles = useStyles(makeStyles);
  const show = useDisplayTime();
  const [outside, setOutside] = React.useState(false);
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const prayer = currentPrayerDay(today());
  const anchors = offeredAnchors(window);
  const range = windowRange(window, prayer);
  const times = slots.filter((s) => !isPrayerAnchor(s));
  // Anchors chosen before the window was known (e.g. «بعد الظهر» on Duha): shown, marked, removable.
  const strayAnchors = slots.filter((s): s is PrayerAnchor => isPrayerAnchor(s) && !anchors.includes(s));
  // A new time opens on the last one chosen when it suits, else inside the window, else on the current hour.
  const start = pickerStart(times, window, prayer, `${nowTime().slice(0, 2)}:00`);
  const toggle = (anchor: PrayerAnchor) =>
    onChange(slots.includes(anchor) ? slots.filter((x) => x !== anchor) : sortChoices([...slots, anchor]));
  const handlePick = (time: LocalTime) => {
    if (window && !isTimeInWindow(time, window, prayer)) {
      setOutside(true);
      return;
    }
    setOutside(false);
    onChange(sortChoices([...slots, time]));
  };

  return (
    <View style={styles.group}>
      {range ? (
        <View style={styles.windowLine}>
          <Icon icon={Clock} size={17} tone="link" />
          <Text variant="small" style={{ flex: 1 }}>
            {t('practice.window.line', { from: show(range.from), to: show(range.to) })}
          </Text>
        </View>
      ) : null}
      <Text variant="small" tone="muted">
        {t('practice.add.slotsHint')}
      </Text>
      {anchors.length > 0 ? (
        <Wrap>
          {anchors.map((anchor) => (
            <Chip
              key={anchor}
              label={`${ANCHOR_LABELS[lang][anchor]}${prayer ? ` · ${show(resolveAnchor(anchor, prayer))}` : ''}`}
              selected={slots.includes(anchor)}
              onPress={() => toggle(anchor)}
            />
          ))}
        </Wrap>
      ) : null}
      {times.length > 0 || strayAnchors.length > 0 ? (
        <Wrap>
          {strayAnchors.map((anchor) => (
            <SlotChip key={anchor} label={ANCHOR_LABELS[lang][anchor]} off onRemove={() => onChange(slots.filter((x) => x !== anchor))} />
          ))}
          {times.map((slot) => (
            <SlotChip
              key={slot}
              label={show(slot)}
              off={!isChoiceSuitable(slot, window, prayer)}
              onRemove={() => onChange(slots.filter((x) => x !== slot))}
            />
          ))}
        </Wrap>
      ) : null}
      <TimePicker
        value={start}
        title={t('practice.add.slots')}
        onPick={handlePick}
        renderTrigger={(open) => <Button label={t('practice.add.customTime')} icon={Plus} onPress={open} variant="outline" />}
      />
      {outside && range ? <ErrorText>{t('practice.window.outside', { from: show(range.from), to: show(range.to) })}</ErrorText> : null}
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
  /** Does not suit the deed's window: marked, so it is removed. */
  off?: boolean;
}

/** One reminder time; tapping it removes it. */
function SlotChip({ label, onRemove, off }: SlotChipProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const remove = t('practice.add.removeSlot', { time: label });
  return (
    <Pressable
      onPress={onRemove}
      android_ripple={{ color: colors.accent }}
      accessibilityRole="button"
      accessibilityLabel={off ? `${remove}. ${t('practice.window.unsuitableSlot')}` : remove}
      style={({ pressed }) => [styles.slot, off && styles.slotOff, pressed && styles.slotPressed]}
    >
      {off ? <Icon icon={TriangleAlert} size={16} tone="destructive" /> : null}
      <Text variant="body" tone={off ? 'destructive' : undefined}>
        {label}
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
