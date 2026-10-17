import { cva } from 'class-variance-authority';

/** Nexa `segment-neutral` look: tinted rounded container, raised active pill. */
export const segmentListVariants = cva(
  'inline-flex items-center gap-1 text-muted-foreground',
  {
    variants: {
      variant: {
        segment: 'rounded-xl bg-muted p-1.5',
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
    'inline-flex min-h-11 items-center justify-center gap-1.5',
    'px-3 text-sm font-medium whitespace-nowrap',
    'outline-none transition-[background-color,color,box-shadow,transform] duration-150',
    'ease-[cubic-bezier(0.23,1,0.32,1)]',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98] motion-reduce:active:scale-100',
  ].join(' '),
  {
    variants: {
      variant: {
        segment:
          'rounded-lg text-muted-foreground hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm data-active:font-semibold',
        underline:
          'rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-2 text-muted-foreground hover:text-foreground data-active:border-foreground data-active:text-foreground data-active:font-semibold',
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
