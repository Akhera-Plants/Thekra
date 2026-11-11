'use client';

import type * as React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<React.ComponentProps<'button'>, 'onChange' | 'role'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * An on/off switch (owner round 4: a real track, about 28px tall, not a bare checkbox). A `button role="switch"`;
 * label it with `aria-labelledby` or `aria-label`. The thumb moves to the inline end when on, so it mirrors in RTL.
 */
export function Switch({ checked, onCheckedChange, className, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-state={checked ? 'on' : 'off'}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        // 44px tap target around a 28×48 track.
        'group relative inline-flex h-11 w-12 shrink-0 cursor-pointer items-center outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-7 w-12 items-center rounded-full border p-0.5 transition-colors duration-150 motion-reduce:transition-none',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring',
          checked ? 'border-primary bg-primary' : 'border-control-border bg-muted',
        )}
      >
        <span
          className={cn(
            'size-6 rounded-full bg-background shadow-sm transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
            checked ? 'translate-x-[18px] rtl:-translate-x-[18px]' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}
