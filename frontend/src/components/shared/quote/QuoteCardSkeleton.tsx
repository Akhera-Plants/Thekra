import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface QuoteCardSkeletonProps {
  density?: 'compact' | 'full';
  /** Pass the same `intent` the real QuoteCard will render with, so the top border thickness matches. */
  intent?: 'sin' | 'good-deed' | 'iman-branch';
  className?: string;
}

/** Geometry-matched skeleton for QuoteCard — prevents layout shift during loading. */
export function QuoteCardSkeleton({
  density = 'full',
  intent,
  className,
}: QuoteCardSkeletonProps) {
  const padding = density === 'compact' ? 'p-4' : 'p-5 md:p-6';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card',
        intent ? 'border-t-[3px]' : null,
        padding,
        className,
      )}
      aria-hidden
    >
      {/* Type badge row */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
      {/* Arabic text lines */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-full rounded-md" />
        <Skeleton className="h-6 w-4/5 rounded-md" />
        <Skeleton className="h-6 w-3/5 rounded-md" />
      </div>
      {/* Source row */}
      <Skeleton className="h-4 w-1/3 rounded-full" />
    </div>
  );
}
