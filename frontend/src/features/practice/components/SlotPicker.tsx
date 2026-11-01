'use client';

import { useId } from 'react';
import { Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ANCHOR_LABELS,
  isPrayerAnchor,
  isValidTime,
  resolveAnchor,
  windowBounds,
  type DeedWindow,
  type PrayerAnchor,
  type PrayerTimesWithSunrise,
} from '@thekra/practice-core';
import { Input } from '@/components/ui/input';
import { formatDigits } from '@/lib/format/digits';
import { windowParts, type WindowPoint } from '@/lib/practice/windows';

const CUSTOM = 'custom';
const NONE = 'none';

/** «من بعد الشروق إلى قبل الظهر», for the line under a habit and for the «outside the window» error. */
export function useWindowRange() {
  const t = useTranslations('practice.window');
  const point = ({ edge, side }: WindowPoint) => t('point', { side, edge: t(`edges.${edge}`) });
  return (window: DeedWindow) => {
    const { from, to } = windowParts(window);
    return t('range', { from: point(from), to: point(to) });
  };
}

/** One short line: when the deed suits, with the clock times when the user's prayer times are known. */
export function WindowLine({ window, prayer, id }: { window: DeedWindow | undefined; prayer: PrayerTimesWithSunrise | undefined; id?: string }) {
  const range = useWindowRange();
  if (!window) return null;
  const bounds = prayer ? windowBounds(window, prayer) : null;
  return (
    <p id={id} className="flex items-center gap-2 text-sm leading-7 text-muted-foreground">
      <Clock className="size-4 shrink-0 text-primary" aria-hidden />
      <span>
        {range(window)}
        {bounds ? (
          <>
            {' · '}
            <bdi>{formatDigits(`${bounds.from}–${bounds.to}`)}</bdi>
          </>
        ) : null}
      </span>
    </p>
  );
}

interface SlotPickerProps {
  label: string;
  value: string;
  optional: boolean;
  /** Only these prayer anchors are offered (practice-core `anchorsFor(habit.window)`); none = a time field only. */
  anchors: readonly PrayerAnchor[];
  prayer: PrayerTimesWithSunrise | undefined;
  onChange: (value: string) => void;
  /** An error under the slot (a time outside the window). */
  error?: string | null;
}

/**
 * One reminder slot: the prayer anchors that suit the deed («بعد الفجر»…, resolved from the city chosen in «أوقات
 * الصلاة», default times otherwise), then «وقت أختاره» with a time field; an optional slot may be «بدون».
 */
export function SlotPicker({ label, value, optional, anchors, prayer, onChange, error }: SlotPickerProps) {
  const t = useTranslations('practice.onboarding');
  const english = useLocale() === 'en';
  const selectId = useId();
  const timeId = useId();
  const errorId = useId();
  const allowedAnchor = isPrayerAnchor(value) && anchors.includes(value);
  const mode = allowedAnchor ? value : isValidTime(value) ? CUSTOM : value === '' && optional ? NONE : CUSTOM;
  const describedBy = error ? errorId : undefined;
  const hasChoice = anchors.length > 0 || optional;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {hasChoice ? (
        <>
          <label htmlFor={selectId}>{label}</label>
          <select
            id={selectId}
            className="h-11 rounded-md border border-input bg-background px-3"
            value={mode}
            onChange={(e) => {
              const next = e.target.value;
              if (next === NONE) onChange('');
              else if (next === CUSTOM) onChange(isValidTime(value) ? value : '');
              else onChange(next);
            }}
          >
            {anchors.map((anchor) => (
              <option key={anchor} value={anchor}>
                {ANCHOR_LABELS[english ? 'en' : 'ar'][anchor]}
                {prayer ? ` (${formatDigits(resolveAnchor(anchor, prayer))})` : ''}
              </option>
            ))}
            <option value={CUSTOM}>{t('customTime')}</option>
            {optional ? <option value={NONE}>{t('noSecondSlot')}</option> : null}
          </select>
        </>
      ) : null}
      {mode === CUSTOM ? (
        <>
          <label htmlFor={timeId} className={hasChoice ? 'sr-only' : undefined}>
            {hasChoice ? t('customTime') : label}
          </label>
          <Input
            id={timeId}
            type="time"
            value={isValidTime(value) ? value : ''}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
          />
        </>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
