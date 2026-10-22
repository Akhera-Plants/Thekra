'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/shared/kit/button';
import { FormattedNumber } from '@/components/shared/FormattedNumber';
import { cn } from '@/lib/utils';

export interface ThemeChip {
  key: string;
  label: string;
  count: number;
}

interface ThemeChipsProps {
  themes: ThemeChip[];
  /** Active theme key; null shows «الكل» pressed. */
  value: string | null;
  onValueChange: (key: string | null) => void;
  allLabel: string;
  /** Accessible name of the group («موضوعات الباب»). */
  label: string;
  /** Language of the labels (Arabic on Arabic pages, English on English); direction follows the page. */
  lang: 'ar' | 'en';
  className?: string;
}

// Quiet chip: the ghost/neutral kit Button with a hairline, pressed state reuses
// the segment-tabs track (bg-muted) so the row reads as part of the same filter.
const CHIP = cn(
  'h-11 min-h-11 rounded-full border-border px-3.5 md:h-11 md:min-h-11',
  'text-muted-foreground aria-pressed:border-transparent aria-pressed:bg-muted aria-pressed:font-semibold aria-pressed:text-foreground',
);

/**
 * One scrollable row of theme toggles under the kind tabs. Native buttons with
 * aria-pressed: Tab moves between them, Enter/Space toggles. Themes with no
 * text on this page are left out unless active (a stale link still shows it).
 */
export function ThemeChips({ themes, value, onValueChange, allLabel, label, lang, className }: ThemeChipsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const shown = themes.filter((theme) => theme.count > 0 || theme.key === value);

  // A preselected chip (from search or a shared link) may sit past the edge on a phone.
  useEffect(() => {
    const row = rowRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !active) return;
    const rowBox = row.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    if (box.left < rowBox.left || box.right > rowBox.right) {
      active.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [value]);

  if (shown.length === 0) return null;

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={label}
      lang={lang}
      className={cn(
        'flex min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain py-0.5',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <Button
        variant="ghost"
        tone="neutral"
        size="sm"
        aria-pressed={value === null}
        onClick={() => onValueChange(null)}
        className={CHIP}
      >
        {allLabel}
      </Button>
      {shown.map((theme) => (
        <Button
          key={theme.key}
          variant="ghost"
          tone="neutral"
          size="sm"
          aria-pressed={theme.key === value}
          onClick={() => onValueChange(theme.key === value ? null : theme.key)}
          className={CHIP}
        >
          <span>{theme.label}</span>
          <span className="text-xs tabular-nums text-current/55">
            <FormattedNumber value={theme.count} />
          </span>
        </Button>
      ))}
    </div>
  );
}
