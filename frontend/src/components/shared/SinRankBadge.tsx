import { cn } from '@/lib/utils';
import type { SinRank } from '@/lib/types/enums';

interface SinRankBadgeProps {
  rank: SinRank;
  /** Translated word (كبيرة / صغيرة). The word is the label; colour is not used alone. */
  label: string;
  className?: string;
}

const RANK_CLASS: Record<SinRank, string> = {
  KABIRA: 'bg-secondary text-secondary-foreground',
  SAGHIRA: 'bg-background text-foreground',
};

/**
 * Scholarly rank (كبيرة / صغيرة). Hidden by the caller when rank is null.
 */
export function SinRankBadge({ rank, label, className }: SinRankBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs',
        RANK_CLASS[rank],
        className,
      )}
    >
      {label}
    </span>
  );
}
