import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The streak's flame (lucide `Flame`) in the warm gold token: a quiet count, never red. */
export function StreakFlame({ className }: { className?: string }) {
  return <Flame aria-hidden className={cn('size-[1.125rem] shrink-0 text-streak', className)} strokeWidth={1.8} />;
}
