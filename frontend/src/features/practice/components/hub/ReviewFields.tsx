'use client';

import { useId, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { REVIEW_NOTE_MAX } from '@thekra/practice-core';
import { Textarea } from '@/components/ui/textarea';
import { formatDigits } from '@/lib/format/digits';
import { cn } from '@/lib/utils';

/** Marks a field Enter can move on from (see {@link nextFieldOnEnter}). */
export const REVIEW_FIELD = 'data-review-field';

/**
 * Enter in a one-line answer moves to the next field of the form instead of adding a line or saving by accident;
 * Shift+Enter is left alone and a composing keyboard (IME) is never touched. On the last field Enter only leaves it.
 */
export function nextFieldOnEnter(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  const root = event.currentTarget.closest('[data-review-form]');
  const fields = root ? Array.from(root.querySelectorAll<HTMLElement>(`[${REVIEW_FIELD}]`)) : [];
  const next = fields[fields.indexOf(event.currentTarget) + 1];
  if (next) next.focus();
  else event.currentTarget.blur();
}

/** The text with `answer` added after it (once), cut at the limit. */
export function withAnswer(value: string, answer: string, max: number = REVIEW_NOTE_MAX): string {
  if (value.includes(answer)) return value;
  const joined = value.trim().length > 0 ? `${value.trim()}، ${answer}` : answer;
  return joined.slice(0, max);
}

/**
 * One question of a review: the member's own words (a short field, at most 280), with the answers they wrote to the
 * daily question as one-tap chips that add themselves to the field.
 */
export function NoteField({
  label,
  value,
  onChange,
  answers = [],
  answersLabel,
  placeholder,
  max = REVIEW_NOTE_MAX,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  answers?: readonly string[];
  answersLabel?: string;
  placeholder?: string;
  max?: number;
}) {
  const t = useTranslations('practice.heart');
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-base font-medium">
          {label}
        </label>
        <span id={`${id}-count`} dir="ltr" className={cn('shrink-0 text-sm tabular-nums text-muted-foreground', value.length === 0 && 'invisible')}>
          {t('count', { n: formatDigits(value.length), max: formatDigits(max) })}
        </span>
      </div>
      <Textarea
        id={id}
        {...{ [REVIEW_FIELD]: '' }}
        value={value}
        maxLength={max}
        rows={2}
        placeholder={placeholder ?? t('placeholder')}
        aria-describedby={`${id}-count`}
        enterKeyHint="next"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={nextFieldOnEnter}
        className="min-h-[4.5rem] resize-none leading-7"
      />
      {answers.length > 0 ? (
        <div role="group" aria-label={answersLabel} className="flex flex-col gap-1">
          {answersLabel ? <p className="text-sm text-muted-foreground">{answersLabel}</p> : null}
          <div className="flex flex-wrap gap-2">
            {answers.slice(0, 6).map((answer) => {
              const used = value.includes(answer);
              return (
                <button
                  key={answer}
                  type="button"
                  disabled={used}
                  onClick={() => onChange(withAnswer(value, answer, max))}
                  className="min-h-11 max-w-full rounded-full border border-border px-4 text-start text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 motion-reduce:transition-none"
                >
                  <span className="line-clamp-1">{answer}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
