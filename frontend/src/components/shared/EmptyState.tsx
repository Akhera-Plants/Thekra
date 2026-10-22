import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  message: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-center',
        className,
      )}
      role="status"
    >
      <div className="rounded-full bg-muted p-4">
        <AlertCircle className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-base font-medium text-foreground">{message}</p>
      {description && (
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}
