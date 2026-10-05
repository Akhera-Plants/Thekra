import { QuoteCardSkeleton } from '@/components/shared/quote';

export default function SinDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10">
      {/* SinHeader skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-8 w-2/3 rounded-md bg-muted" />
        <div className="h-4 w-1/3 rounded-full bg-muted" />
        <div className="h-4 w-full rounded-full bg-muted" />
      </div>
      {/* Quote list skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <QuoteCardSkeleton key={i} />
      ))}
    </div>
  );
}
