import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message,
  retryLabel,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-center',
        className,
      )}
      role="alert"
    >
      <div className="rounded-full bg-destructive/10 p-4">
        <TriangleAlert
          className="size-6 text-destructive"
          aria-hidden
        />
      </div>
      <p className="text-base font-medium text-foreground">{message}</p>
      {onRetry && retryLabel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
