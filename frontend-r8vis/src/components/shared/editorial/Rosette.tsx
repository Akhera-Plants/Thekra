import { cn } from '@/lib/utils';

/**
 * The one section mark: an 8-point geometric rosette (two squares, one turned).
 * A book uses a single ornament between sections, never as a texture.
 */
export function Rosette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn('size-4 text-muted-foreground', className)}
      aria-hidden
    >
      <rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect
        x="3"
        y="3"
        width="14"
        height="14"
        transform="rotate(45 10 10)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
