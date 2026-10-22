import { cva, type VariantProps } from 'class-variance-authority';
import { ArrowUpLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { formatCount } from './format';

const numberVariants = cva('font-arabic-display leading-none font-semibold tracking-tight tabular-nums', {
  variants: {
    size: {
      focal: 'text-5xl',
      inline: 'text-2xl',
    },
    tone: {
      danger: 'text-destructive',
      caution: 'text-foreground',
      neutral: 'text-foreground',
    },
  },
  defaultVariants: { size: 'focal', tone: 'neutral' },
});

export interface StatNumberProps extends VariantProps<typeof numberVariants> {
  label: string;
  value: number | undefined;
  hint?: string;
  href?: string;
  isLoading?: boolean;
  isError?: boolean;
  errorLabel?: string;
  className?: string;
}

/**
 * One count that means something: big tabular figure, a label that says what it is,
 * a hint that says why it matters, and (when given) a link to the filtered queue.
 * Danger tone only lights up when the value is above zero — a zero is good news.
 */
export function StatNumber({
  label,
  value,
  hint,
  href,
  isLoading,
  isError,
  errorLabel,
  size,
  tone,
  className,
}: StatNumberProps) {
  const effectiveTone = tone === 'danger' && !value ? 'neutral' : tone;
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {label}
        {href ? (
          <ArrowUpLeft
            aria-hidden
            className="size-3.5 opacity-0 transition-opacity duration-150 group-hover/stat:opacity-100 group-focus-visible/stat:opacity-100 ltr:-scale-x-100"
          />
        ) : null}
      </span>
      {isLoading ? (
        <Skeleton className={cn(size === 'inline' ? 'h-6 w-16' : 'h-12 w-28')} />
      ) : isError ? (
        <span className="text-sm text-destructive">{errorLabel}</span>
      ) : (
        <span className={numberVariants({ size, tone: effectiveTone })}>{formatCount(value ?? 0)}</span>
      )}
      {hint ? <span className="text-xs text-pretty text-muted-foreground">{hint}</span> : null}
    </>
  );

  const frame = 'group/stat flex min-w-0 flex-col gap-3 rounded-lg p-4';
  if (!href) return <div className={cn(frame, className)}>{body}</div>;
  return (
    <Link
      href={href}
      className={cn(
        frame,
        'desk-press outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {body}
    </Link>
  );
}
