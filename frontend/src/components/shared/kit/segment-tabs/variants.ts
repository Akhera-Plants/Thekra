import { cva } from 'class-variance-authority';

/**
 * Nexa `segment-neutral`: tinted track + raised active pill that stays *inside* the pad.
 * Whole control is ≥44px tall; the pill never overflows the track.
 */
export const segmentListVariants = cva(
  [
    'inline-flex max-w-full items-stretch gap-0.5 overflow-hidden',
    'text-muted-foreground',
    // Kill stock TabsList height (h-8) so our pad + stretch wins.
    'h-auto! min-h-11',
  ].join(' '),
  {
    variants: {
      variant: {
        segment: 'rounded-full bg-muted p-1',
        underline:
          'gap-0 rounded-none bg-transparent p-0 shadow-[inset_0_-2px_0_0_var(--border)]',
      },
      size: {
        hugged: 'w-fit',
        filled: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'segment',
      size: 'hugged',
    },
  },
);

export const segmentTriggerVariants = cva(
  [
    'relative inline-flex min-h-0 flex-none items-center justify-center gap-1.5',
    'px-3.5 text-sm font-medium whitespace-nowrap',
    'border-0 bg-transparent shadow-none outline-none',
    'transition-[background-color,color,box-shadow,transform] duration-150',
    'ease-[cubic-bezier(0.23,1,0.32,1)]',
    'focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98] motion-reduce:active:scale-100',
    // Kill stock trigger height / line-underline pseudo.
    'h-auto! after:hidden!',
  ].join(' '),
  {
    variants: {
      variant: {
        segment: [
          'self-stretch rounded-full text-muted-foreground',
          'hover:text-foreground',
          'data-active:bg-background data-active:text-foreground data-active:shadow-sm data-active:font-semibold',
          'dark:data-active:border-transparent dark:data-active:bg-background dark:data-active:text-foreground',
        ].join(' '),
        underline: [
          'rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-2',
          'text-muted-foreground hover:text-foreground',
          'data-active:border-foreground data-active:text-foreground data-active:font-semibold data-active:shadow-none',
        ].join(' '),
      },
      size: {
        hugged: 'shrink-0 grow-0',
        filled: 'min-w-0 flex-1',
      },
    },
    defaultVariants: {
      variant: 'segment',
      size: 'hugged',
    },
  },
);
