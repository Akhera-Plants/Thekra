import { cva } from 'class-variance-authority';

/**
 * Thekra Button — nexa-shaped API (variant × tone × size), Scholar's Desk tokens.
 *
 * Affordance rule (from nexa): outline/ghost must still read as controls.
 * Outline starts as bordered + filled paper, then paints solid on hover.
 * Ghost stays quiet until hover. Link underlines on hover.
 */
export const buttonVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap',
    'rounded-2xl font-medium outline-none select-none',
    'transition-[transform,background-color,border-color,color,opacity,box-shadow] duration-150',
    'ease-[cubic-bezier(0.23,1,0.32,1)]',
    'active:scale-[0.97] motion-reduce:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-offset-0',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(' '),
  {
    variants: {
      variant: {
        solid: 'border border-transparent shadow-xs',
        outline: 'border bg-background shadow-xs',
        ghost: 'border border-transparent bg-transparent',
        link: 'border-transparent bg-transparent underline-offset-4 hover:underline',
      },
      tone: {
        primary: '',
        neutral: '',
        destructive: '',
        sin: '',
        deed: '',
        branch: '',
      },
      size: {
        sm: 'min-h-11 h-11 px-3 text-sm font-medium md:h-8 md:min-h-8',
        md: 'min-h-11 h-11 px-4 text-sm font-medium md:h-10 md:min-h-10',
        lg: 'min-h-11 h-11 px-5 text-sm font-medium',
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

      // ── Primary (verdigris seal) ──────────────────────────────────────
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
          'border-primary text-primary hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground data-[selected]:bg-primary data-[selected]:text-primary-foreground',
      },
      {
        variant: 'ghost',
        tone: 'primary',
        className:
          'text-primary hover:bg-primary/15 active:bg-primary/25 data-[selected]:bg-primary/20',
      },
      {
        variant: 'link',
        tone: 'primary',
        className: 'text-primary',
      },

      // ── Neutral (paper / ink) ─────────────────────────────────────────
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
          'border-border text-foreground hover:bg-foreground hover:text-background active:bg-foreground active:text-background data-[selected]:bg-foreground data-[selected]:text-background',
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

      // ── Destructive (red correction ink) ──────────────────────────────
      {
        variant: 'solid',
        tone: 'destructive',
        className:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive data-[selected]:bg-destructive',
      },
      {
        variant: 'outline',
        tone: 'destructive',
        className:
          'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground active:bg-destructive active:text-destructive-foreground data-[selected]:bg-destructive data-[selected]:text-destructive-foreground',
      },
      {
        variant: 'ghost',
        tone: 'destructive',
        className:
          'text-destructive hover:bg-destructive/15 active:bg-destructive/25 data-[selected]:bg-destructive/20',
      },
      {
        variant: 'link',
        tone: 'destructive',
        className: 'text-destructive',
      },

      // ── Sin path ──────────────────────────────────────────────────────
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
          'border-intent-sin text-intent-sin hover:bg-intent-sin hover:text-intent-sin-foreground active:bg-intent-sin active:text-intent-sin-foreground data-[selected]:bg-intent-sin data-[selected]:text-intent-sin-foreground',
      },
      {
        variant: 'ghost',
        tone: 'sin',
        className:
          'text-intent-sin hover:bg-intent-sin/15 active:bg-intent-sin/25 data-[selected]:bg-intent-sin/20',
      },
      {
        variant: 'link',
        tone: 'sin',
        className: 'text-intent-sin',
      },

      // ── Deed path ─────────────────────────────────────────────────────
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
          'border-intent-good-deed text-intent-good-deed hover:bg-intent-good-deed hover:text-intent-good-deed-foreground active:bg-intent-good-deed active:text-intent-good-deed-foreground data-[selected]:bg-intent-good-deed data-[selected]:text-intent-good-deed-foreground',
      },
      {
        variant: 'ghost',
        tone: 'deed',
        className:
          'text-intent-good-deed hover:bg-intent-good-deed/15 active:bg-intent-good-deed/25 data-[selected]:bg-intent-good-deed/20',
      },
      {
        variant: 'link',
        tone: 'deed',
        className: 'text-intent-good-deed',
      },

      // ── Branch path ───────────────────────────────────────────────────
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
          'border-intent-iman-branch text-intent-iman-branch hover:bg-intent-iman-branch hover:text-intent-iman-branch-foreground active:bg-intent-iman-branch active:text-intent-iman-branch-foreground data-[selected]:bg-intent-iman-branch data-[selected]:text-intent-iman-branch-foreground',
      },
      {
        variant: 'ghost',
        tone: 'branch',
        className:
          'text-intent-iman-branch hover:bg-intent-iman-branch/15 active:bg-intent-iman-branch/25 data-[selected]:bg-intent-iman-branch/20',
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
