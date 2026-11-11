'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { formatDigits } from '@/lib/format/digits';
import { cn } from '@/lib/utils';

/** Saturday first in Arabic (the week as it is read here), Sunday first in English. */
const ORDER_AR = [6, 0, 1, 2, 3, 4, 5];
const ORDER_EN = [0, 1, 2, 3, 4, 5, 6];

/**
 * «الأيام» (A-13 a): the seven weekdays as pressed chips; the member picks the days themselves and the count follows
 * («3 أيام في الأسبوع»). At least one day stays on (the last one cannot be turned off).
 */
export function DayChips({ value, onChange, legend }: { value: readonly number[]; onChange: (days: number[]) => void; legend: string }) {
  const t = useTranslations('practice.weekdaysShort');
  const tFull = useTranslations('practice.weekdays');
  const tSetup = useTranslations('practice.setup');
  const countId = useId();
  const order = tSetup('weekStart') === 'sun' ? ORDER_EN : ORDER_AR;
  const on = new Set(value);
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={countId}>
      <legend className="mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {order.map((day) => {
          const pressed = on.has(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={pressed}
              aria-label={tFull(`d${day}`)}
              onClick={() => {
                if (pressed && on.size === 1) return;
                onChange(pressed ? value.filter((d) => d !== day) : [...value, day]);
              }}
              className={cn(
                'inline-flex min-h-11 min-w-14 items-center justify-center rounded-full border px-3 text-sm transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
                pressed ? 'border-primary bg-secondary font-medium text-primary-text' : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {t(`d${day}`)}
            </button>
          );
        })}
      </div>
      <p id={countId} className="text-sm text-muted-foreground" role="status">
        {tSetup('daysCount', { count: on.size, n: formatDigits(on.size) })}
      </p>
    </fieldset>
  );
}
