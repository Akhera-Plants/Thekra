import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface QuoteCardSkeletonProps {
  density?: 'compact' | 'full';
  /** Kept for API parity with QuoteCard; chrome no longer uses a top accent. */
  intent?: 'sin' | 'good-deed' | 'iman-branch';
  className?: string;
}

/** Geometry-matched skeleton for QuoteCard — prevents layout shift during loading. */
export function QuoteCardSkeleton({
  density = 'full',
  className,
}: QuoteCardSkeletonProps) {
  const padding =
    density === 'compact' ? 'gap-4 px-4 py-4 md:px-5 md:py-5' : 'gap-5 px-5 py-5 md:gap-6 md:px-7 md:py-7';

  return (
    <div
      className={cn(
        'flex flex-col rounded-[1.35rem] border border-border/80 bg-card',
        'shadow-[0_1px_2px_oklch(0.18_0.007_255_/_0.04)]',
        padding,
        className,
      )}
      aria-hidden
    >
      <div className="flex flex-col items-start gap-2">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-40 rounded-full" />
      </div>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-7 w-full rounded-md" />
        <Skeleton className="h-7 w-[92%] rounded-md" />
        <Skeleton className="h-7 w-3/4 rounded-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
    </div>
  );
}
