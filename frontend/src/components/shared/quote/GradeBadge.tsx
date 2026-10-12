import { Check } from 'lucide-react';
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
  /** Sahih/Hasan get a tiny confirming checkmark; Da'if/Mawdu never do (never alarming, never over-asserted). */
  showCheck: boolean;
}

const GRADE_SEAL_CONFIG = {
  [HadithGrade.SAHIH]: {
    classes: 'bg-grade-sahih text-grade-sahih-foreground ring-grade-sahih/35',
    showCheck: true,
  },
  [HadithGrade.HASAN]: {
    classes: 'bg-grade-hasan text-grade-hasan-foreground ring-grade-hasan/35',
    showCheck: true,
  },
  [HadithGrade.DAIF]: {
    classes: 'bg-grade-daif text-grade-daif-foreground ring-grade-daif/35',
    showCheck: false,
  },
  [HadithGrade.MAWDU]: {
    classes: 'bg-grade-mawdu text-grade-mawdu-foreground ring-grade-mawdu/35',
    showCheck: false,
  },
  [HadithGrade.UNGRADED]: {
    classes: 'bg-muted text-muted-foreground ring-border',
    showCheck: false,
  },
} satisfies Record<HadithGrade, GradeSealConfig>;

/**
 * Shows the hadith grade as a small circular "seal" — never colour alone
 * (plan §7.2 + ARCHITECTURE §1 + design-language-sakina.md §Card/Badge redesign).
 * `aria-label` carries the grade phrase, e.g. "حديث صحيح"; the word is also always
 * rendered as visible text, never implied by colour or icon alone.
 */
export function GradeBadge({ grade, label, className }: GradeBadgeProps) {
  const { classes, showCheck } = GRADE_SEAL_CONFIG[grade];

  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-semibold ring-2',
        classes,
        className,
      )}
      aria-label={label}
    >
      {showCheck && <Check className="size-3 shrink-0" aria-hidden />}
      <span aria-hidden className="leading-none">
        {label}
      </span>
    </span>
  );
}
