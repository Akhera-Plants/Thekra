import { cn } from '@/lib/utils';

/**
 * The profile mark (owner round 7, R7-A5: «غيّر ايقونة البروفايل لوحدة احلى واسلس»): a soft green disc with a thin
 * ring and a rounded head-and-shoulders glyph in our own strokes — no grey initials, no letters joined into a
 * monogram. The app draws the same mark (mobile/src/ui/ProfileMark.tsx).
 */
export function ProfileMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-primary-text transition-colors',
        className,
      )}
    >
      <svg viewBox="0 0 32 32" fill="none" className="size-full" focusable="false">
        <circle cx="16" cy="12.6" r="4.6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7.6 26.4c1.5-4.4 4.6-6.6 8.4-6.6s6.9 2.2 8.4 6.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}
