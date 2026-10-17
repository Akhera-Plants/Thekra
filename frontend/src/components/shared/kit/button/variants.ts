import { cva } from 'class-variance-authority';

/**
 * Thekra Button — nexa-shaped API (variant × tone × size), Sakina tokens only.
 * Press: scale(0.97). Focus: ring. Minimum 44px touch target on every size.
 */
export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
    'rounded-2xl font-medium outline-none select-none',
    'transition-[transform,background-color,border-color,color,opacity] duration-150',
    'ease-[cubic-bezier(0.23,1,0.32,1)]',
    'active:scale-[0.97] motion-reduce:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
  ].join(' '),
  {
    variants: {
      variant: {
        solid: 'border border-transparent',
        outline: 'border bg-background',
        ghost: 'border border-transparent bg-transparent',
        link: 'border-transparent bg-transparent underline-offset-4 hover:underline',
      },
      tone: {
        primary: '',
        neutral: '',
        sin: '',
        deed: '',
        branch: '',
      },
      size: {
        sm: 'min-h-11 h-11 px-3 text-xs md:h-8 md:min-h-8',
        md: 'min-h-11 h-11 px-4 text-sm md:h-10 md:min-h-10',
        lg: 'min-h-11 h-11 px-5 text-base',
      },
      iconOnly: {
        true: 'aspect-square px-0',
        false: '',
      },
    },
    compoundVariants: [
      { iconOnly: true, size: 'sm', className: 'size-11 md:size-8' },
      { iconOnly: true, size: 'md', className: 'size-11 md:size-10' },
      { iconOnly: true, size: 'lg', className: 'size-11' },

      // Primary
      {
        variant: 'solid',
        tone: 'primary',
        className:
          'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary data-[selected]:bg-primary',
      },
      {
        variant: 'outline',
        tone: 'primary',
        className:
          'border-primary text-primary hover:bg-primary/10 active:bg-primary/15 data-[selected]:bg-primary/15',
      },
      {
        variant: 'ghost',
        tone: 'primary',
        className:
          'text-primary hover:bg-primary/10 active:bg-primary/15 data-[selected]:bg-primary/15',
      },
      {
        variant: 'link',
        tone: 'primary',
        className: 'text-primary',
      },

      // Neutral
      {
        variant: 'solid',
        tone: 'neutral',
        className:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary data-[selected]:bg-secondary',
      },
      {
        variant: 'outline',
        tone: 'neutral',
        className:
          'border-border text-foreground hover:bg-muted active:bg-muted data-[selected]:bg-muted',
      },
      {
        variant: 'ghost',
        tone: 'neutral',
        className:
          'text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted data-[selected]:bg-muted data-[selected]:text-foreground',
      },
      {
        variant: 'link',
        tone: 'neutral',
        className: 'text-muted-foreground hover:text-foreground',
      },

      // Sin (verdigris)
      {
        variant: 'solid',
        tone: 'sin',
        className:
          'bg-intent-sin text-intent-sin-foreground hover:bg-intent-sin/90 active:bg-intent-sin data-[selected]:bg-intent-sin',
      },
      {
        variant: 'outline',
        tone: 'sin',
        className:
          'border-intent-sin text-intent-sin hover:bg-intent-sin/10 active:bg-intent-sin/15 data-[selected]:bg-intent-sin/15',
      },
      {
        variant: 'ghost',
        tone: 'sin',
        className:
          'text-intent-sin hover:bg-intent-sin/10 active:bg-intent-sin/15 data-[selected]:bg-intent-sin/15',
      },
      {
        variant: 'link',
        tone: 'sin',
        className: 'text-intent-sin',
      },

      // Deed (amber)
      {
        variant: 'solid',
        tone: 'deed',
        className:
          'bg-intent-good-deed text-intent-good-deed-foreground hover:bg-intent-good-deed/90 active:bg-intent-good-deed data-[selected]:bg-intent-good-deed',
      },
      {
        variant: 'outline',
        tone: 'deed',
        className:
          'border-intent-good-deed text-intent-good-deed hover:bg-intent-good-deed/10 active:bg-intent-good-deed/15 data-[selected]:bg-intent-good-deed/15',
      },
      {
        variant: 'ghost',
        tone: 'deed',
        className:
          'text-intent-good-deed hover:bg-intent-good-deed/10 active:bg-intent-good-deed/15 data-[selected]:bg-intent-good-deed/15',
      },
      {
        variant: 'link',
        tone: 'deed',
        className: 'text-intent-good-deed',
      },

      // Branch (ink slate)
      {
        variant: 'solid',
        tone: 'branch',
        className:
          'bg-intent-iman-branch text-intent-iman-branch-foreground hover:bg-intent-iman-branch/90 active:bg-intent-iman-branch data-[selected]:bg-intent-iman-branch',
      },
      {
        variant: 'outline',
        tone: 'branch',
        className:
          'border-intent-iman-branch text-intent-iman-branch hover:bg-intent-iman-branch/10 active:bg-intent-iman-branch/15 data-[selected]:bg-intent-iman-branch/15',
      },
      {
        variant: 'ghost',
        tone: 'branch',
        className:
          'text-intent-iman-branch hover:bg-intent-iman-branch/10 active:bg-intent-iman-branch/15 data-[selected]:bg-intent-iman-branch/15',
      },
      {
        variant: 'link',
        tone: 'branch',
        className: 'text-intent-iman-branch',
      },
    ],
    defaultVariants: {
      variant: 'solid',
      tone: 'primary',
      size: 'md',
      iconOnly: false,
    },
  },
);
