'use client';

import { useTranslations } from 'next-intl';
import { isValidTime } from '@thekra/practice-core';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const STEP_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface TimeFieldProps {
  /** The hour select's id (a `<label htmlFor>` may point at it). */
  id: string;
  /** What the time is for («الوقت»): read with «الساعة» / «الدقيقة». */
  label: string;
  value: string;
  onChange: (time: string) => void;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

const SELECT =
  'h-11 rounded-lg border border-input bg-background px-2 text-base tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive';

/**
 * A 24-hour time as two native selects (hour : minute, Western digits). The browser's own `<input type="time">` follows
 * the browser's language, not the page's, and showed «PM» on Arabic pages (owner rule: no Latin on Arabic pages).
 * Minutes step by 5; a stored time off that step is kept as an extra option. Always laid out hour-first, left to right.
 */
export function TimeField({ id, label, value, onChange, invalid, describedBy, className }: TimeFieldProps) {
  const t = useTranslations('practice.timeField');
  const valid = isValidTime(value);
  const [hour, minute] = valid ? value.split(':') : ['', ''];
  const minutes = minute && !STEP_MINUTES.includes(minute) ? [...STEP_MINUTES, minute].sort() : STEP_MINUTES;
  const emit = (h: string, m: string) => {
    const next = `${h}:${m}`;
    if (isValidTime(next)) onChange(next);
  };
  return (
    // A clock reads hour then minute left to right in both languages.
    <div dir="ltr" className={cn('inline-flex items-center gap-1', className)}>
      <select
        id={id}
        aria-label={`${label}: ${t('hour')}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={SELECT}
        value={hour}
        onChange={(e) => emit(e.target.value, minute || '00')}
      >
        {valid ? null : <option value="">--</option>}
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-muted-foreground">
        :
      </span>
      <select
        aria-label={`${label}: ${t('minute')}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={SELECT}
        value={minute}
        onChange={(e) => emit(hour || '00', e.target.value)}
      >
        {valid ? null : <option value="">--</option>}
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
