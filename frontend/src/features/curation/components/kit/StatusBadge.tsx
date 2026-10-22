import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { FlagSeverity, FlagStatus, MatchDecision } from '@/lib/format/admin-labels';
import type { HadithGrade, LinkReviewStatus, SyncStatus } from '@/lib/types/enums';

/**
 * A state word with a dot — never a filled pill. Colour carries meaning only:
 * danger = red correction ink (high, hidden, failed), caution = the lamp (medium, pending),
 * positive = the teal seal (published, accepted), quiet = pencil (low, closed).
 */
const statusBadgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap font-medium', {
  variants: {
    tone: {
      danger: 'text-destructive',
      caution: 'text-foreground',
      positive: 'text-foreground',
      quiet: 'text-muted-foreground',
      neutral: 'text-foreground',
    },
    size: {
      sm: 'text-xs',
      md: 'text-sm',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'sm' },
});

const dotVariants = cva('size-1.5 shrink-0 rounded-full', {
  variants: {
    tone: {
      danger: 'bg-destructive',
      caution: 'bg-intent-good-deed',
      positive: 'bg-primary',
      quiet: 'bg-muted-foreground/50',
      neutral: 'bg-foreground/60',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type StatusTone = NonNullable<VariantProps<typeof statusBadgeVariants>['tone']>;

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  label: string;
  className?: string;
  /** Hide the word visually but keep it for assistive tech (dot-only table columns). */
  dotOnly?: boolean;
}

export function StatusBadge({ label, tone, size, dotOnly, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone, size }), className)}>
      <span aria-hidden className={dotVariants({ tone })} />
      <span className={cn(dotOnly && 'sr-only')}>{label}</span>
    </span>
  );
}

// ── One tone map per enum, read once (design-system.mdc §5.1) ────────────────

export const SEVERITY_TONE = {
  HIGH: 'danger',
  MEDIUM: 'caution',
  LOW: 'quiet',
} as const satisfies Record<FlagSeverity, StatusTone>;

export const FLAG_STATUS_TONE = {
  OPEN: 'caution',
  RESOLVED: 'positive',
  DISMISSED: 'quiet',
} as const satisfies Record<FlagStatus, StatusTone>;

export const REVIEW_STATUS_TONE = {
  NOT_REVIEWED: 'caution',
  UNDER_REVIEW: 'caution',
  REVIEWED: 'neutral',
  ACCEPTED: 'positive',
  REJECTED: 'danger',
} as const satisfies Record<LinkReviewStatus, StatusTone>;

export const SYNC_STATUS_TONE = {
  PENDING: 'quiet',
  RUNNING: 'caution',
  SUCCESS: 'positive',
  FAILED: 'danger',
} as const satisfies Record<SyncStatus, StatusTone>;

export const GRADE_TONE = {
  SAHIH: 'positive',
  HASAN: 'positive',
  DAIF: 'caution',
  MAWDU: 'danger',
  UNGRADED: 'quiet',
} as const satisfies Record<HadithGrade, StatusTone>;

export const DECISION_TONE = {
  CANDIDATE: 'caution',
  CONFIRMED: 'positive',
  REJECTED: 'quiet',
} as const satisfies Record<MatchDecision, StatusTone>;
