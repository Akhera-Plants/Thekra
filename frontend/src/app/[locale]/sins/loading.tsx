import { Skeleton } from '@/components/ui/skeleton';

export default function SinsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <Skeleton className="h-9 w-32 rounded-md" />
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton className="h-5 w-3/5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
