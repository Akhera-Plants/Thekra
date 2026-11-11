import type { PresenceLevel } from '@/lib/practice/hub';
import { cn } from '@/lib/utils';

interface PresenceMarkProps {
  level: PresenceLevel;
  /** On a filled (primary) background, e.g. the selected day. */
  inverted?: boolean;
  className?: string;
}

/**
 * A day's presence as a small mark: an empty ring, a half-filled ring («أي قدر يُحسب») or a full dot. Decorative: the
 * day's button carries the words. `none` keeps the space so rows do not jump.
 */
export function PresenceMark({ level, inverted = false, className }: PresenceMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'block size-2 shrink-0 rounded-full border',
        level === 'none' && 'border-transparent',
        level === 'empty' && (inverted ? 'border-primary-foreground/60' : 'border-muted-foreground/50'),
        level === 'partial' &&
          (inverted
            ? 'border-primary-foreground bg-[linear-gradient(to_top,var(--primary-foreground)_50%,transparent_50%)]'
            : 'border-primary bg-[linear-gradient(to_top,var(--primary)_50%,transparent_50%)]'),
        level === 'full' && (inverted ? 'border-primary-foreground bg-primary-foreground' : 'border-primary bg-primary'),
        className,
      )}
    />
  );
}
