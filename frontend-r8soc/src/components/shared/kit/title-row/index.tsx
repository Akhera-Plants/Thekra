import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A page or section title with its one action on the same line, opposite it (owner round 5, O-02/W-13): the action
 * belongs to the whole page/section, so it never floats on a line of its own under the title. The action is an
 * icon + text button; on a narrow screen a long title wraps and the action stays at the line's end.
 */
export function TitleRow({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-start justify-between gap-3', className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="flex shrink-0 items-center pt-1">{action}</div> : null}
    </div>
  );
}
