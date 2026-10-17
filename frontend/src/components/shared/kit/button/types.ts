import type * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { buttonVariants } from './variants';

export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link';
export type ButtonTone = 'primary' | 'neutral' | 'sin' | 'deed' | 'branch';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonIconPosition = 'start' | 'end';

export interface ButtonProps
  extends
    Omit<React.ComponentProps<'button'>, 'color'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: ButtonIconPosition;
  iconOnly?: boolean;
}
