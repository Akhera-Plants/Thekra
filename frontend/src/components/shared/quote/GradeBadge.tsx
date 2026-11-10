import { cn } from '@/lib/utils';
import { HadithGrade } from '@/lib/types/enums';

interface GradeBadgeProps {
  grade: HadithGrade;
  /** Translated grade word, e.g. "صحيح" or "Sahih" */
  label: string;
  className?: string;
}

interface GradeSealConfig {
  /** Filled seal colours — background + a readable foreground pair, never a tint-only pattern. */
  classes: string;
}

const GRADE_SEAL_CONFIG = {
  [HadithGrade.SAHIH]: {
    classes: 'bg-grade-sahih text-grade-sahih-foreground',
  },
  [HadithGrade.HASAN]: {
    classes: 'bg-grade-hasan text-grade-hasan-foreground',
  },
  [HadithGrade.DAIF]: {
    classes: 'bg-grade-daif text-grade-daif-foreground',
  },
  [HadithGrade.MAWDU]: {
    classes: 'bg-grade-mawdu text-grade-mawdu-foreground',
  },
  [HadithGrade.UNGRADED]: {
    classes: 'bg-muted text-muted-foreground',
  },
} satisfies Record<HadithGrade, GradeSealConfig>;

/**
 * Shows the hadith grade as a small circular "seal": the grade word only, no check mark (owner round 7, B3) — never
 * colour alone
 * (plan §7.2 + ARCHITECTURE §1 + design-language-sakina.md §Card/Badge redesign).
 * The grade word is visible text (read as such by screen readers), never implied by colour
 * or icon alone.
 */
export function GradeBadge({ grade, label, className }: GradeBadgeProps) {
  const { classes } = GRADE_SEAL_CONFIG[grade];

  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2.5 text-xs font-semibold',
        classes,
        className,
      )}
    >
      {/* The visible word is what screen readers read: aria-label is not allowed on a plain span. */}
      <span className="leading-none">{label}</span>
    </span>
  );
}
