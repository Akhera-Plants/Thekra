'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';
import type { ButtonProps } from './types';
import { buttonVariants } from './variants';

function Button({
  className,
  variant = 'solid',
  tone = 'primary',
  size = 'md',
  asChild = false,
  loading = false,
  disabled,
  icon,
  iconPosition = 'start',
  iconOnly = false,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(loading || disabled);
  const classes = cn(buttonVariants({ variant, tone, size, iconOnly }), className);

  const content = loading ? (
    <Loader2 className="size-4 animate-spin" aria-hidden />
  ) : iconOnly ? (
    icon
  ) : (
    <>
      {icon && iconPosition === 'start' ? icon : null}
      {children}
      {icon && iconPosition === 'end' ? icon : null}
    </>
  );

  const shared = {
    'data-slot': 'thekra-button' as const,
    'data-variant': variant ?? undefined,
    'data-tone': tone ?? undefined,
    'data-size': size ?? undefined,
    'data-icon-only': iconOnly || undefined,
    'data-loading': loading || undefined,
    className: classes,
    'aria-busy': loading || undefined,
  };

  if (asChild) {
    // Slot merges its props into exactly one child element; a fragment (`content`) would receive them instead
    // (React warns: invalid prop `data-slot` on React.Fragment). As a slot, the child brings its own content.
    return (
      <Slot.Root
        {...shared}
        aria-disabled={isDisabled || undefined}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button type={type} disabled={isDisabled} {...shared} {...props}>
      {content}
    </button>
  );
}

export { Button, buttonVariants };
export type { ButtonProps, ButtonVariant, ButtonTone, ButtonSize, ButtonIconPosition } from './types';
