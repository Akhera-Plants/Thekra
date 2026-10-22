import { ArrowRight, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Forward/continue arrow that respects document direction:
 * - LTR → points right
 * - RTL → points left (via rtl:-scale-x-100)
 *
 * Do NOT use ArrowLeft + rtl flip — that reverses both locales.
 */
export function DirectionalArrow({ className, ...props }: LucideProps) {
  return (
    <ArrowRight
      aria-hidden
      className={cn('shrink-0 rtl:-scale-x-100', className)}
      {...props}
    />
  );
}
