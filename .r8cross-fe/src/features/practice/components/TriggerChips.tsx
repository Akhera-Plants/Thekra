'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { TRIGGER_FEELINGS, TRIGGER_PLACES, TRIGGER_TIMES, type Triggers } from '@thekra/practice-core';
import { cn } from '@/lib/utils';

interface TriggerChipsProps {
  value: Triggers;
  onChange: (next: Triggers) => void;
  /** Hide the group's title (the caller shows its own). */
  hideTitle?: boolean;
}

/**
 * «ما الذي سبقها؟»: three optional rows of chips (when / where / feeling), one choice per row, a second tap clears it.
 * Chips only, no free text: they stay inside the program on this device (and the encrypted vault).
 */
export function TriggerChips({ value, onChange, hideTitle = false }: TriggerChipsProps) {
  const t = useTranslations('leaveSin.triggers');
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={hideTitle ? undefined : titleId} aria-label={hideTitle ? t('title') : undefined} className="flex flex-col gap-3">
      {hideTitle ? null : (
        <p id={titleId} className="font-medium">
          {t('title')}
        </p>
      )}
      <ChipRow
        label={t('when')}
        options={TRIGGER_TIMES.map((key) => ({ key, label: t(`times.${key}`) }))}
        selected={value.when}
        onSelect={(when) => onChange({ ...value, when })}
      />
      <ChipRow
        label={t('where')}
        options={TRIGGER_PLACES.map((key) => ({ key, label: t(`places.${key}`) }))}
        selected={value.where}
        onSelect={(where) => onChange({ ...value, where })}
      />
      <ChipRow
        label={t('feeling')}
        options={TRIGGER_FEELINGS.map((key) => ({ key, label: t(`feelings.${key}`) }))}
        selected={value.feeling}
        onSelect={(feeling) => onChange({ ...value, feeling })}
      />
    </div>
  );
}

interface ChipRowProps<K extends string> {
  label: string;
  options: { key: K; label: string }[];
  selected: K | undefined;
  onSelect: (key: K | undefined) => void;
}

function ChipRow<K extends string>({ label, options, selected, onSelect }: ChipRowProps<K>) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm text-muted-foreground">
        {label}
      </span>
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected === option.key;
          return (
            <li key={option.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? undefined : option.key)}
                className={cn(
                  'min-h-11 rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                )}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
