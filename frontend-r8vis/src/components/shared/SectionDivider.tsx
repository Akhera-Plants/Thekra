import { cn } from '@/lib/utils';

/**
 * The home page's ornamental divider between the sub-sections of a page (owner round 3, item 18). Decorative only.
 * `compact` drops the home page's own vertical margins, for pages whose sections already sit in a gap.
 */
export function SectionDivider({ compact = true, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('ornamental-divider', compact && 'ornamental-divider--compact', className)} aria-hidden>
      <span />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG asset */}
      <img src="/ornaments/section-ornament.svg" width={56} height={28} alt="" />
      <span />
    </div>
  );
}
