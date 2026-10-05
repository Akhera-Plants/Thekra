import { cn } from '@/lib/utils';
import { HadithGrade } from '@/lib/types/enums';

interface GradeBadgeProps {
  grade: HadithGrade;
  /** Translated grade word, e.g. "صحيح" or "Sahih" */
  label: string;
  className?: string;
}

const GRADE_CLASSES: Record<HadithGrade, string> = {
  [HadithGrade.SAHIH]: 'bg-grade-sahih/10 text-grade-sahih border-grade-sahih/30',
  [HadithGrade.HASAN]: 'bg-grade-hasan/10 text-grade-hasan border-grade-hasan/30',
  [HadithGrade.DAIF]: 'bg-grade-daif/10 text-grade-daif border-grade-daif/30',
  [HadithGrade.MAWDU]: 'bg-muted text-muted-foreground border-border',
  [HadithGrade.UNGRADED]: 'bg-muted text-muted-foreground border-border',
};

/**
 * Shows the hadith grade as a text badge — never colour alone (plan §7.2 + ARCHITECTURE §1).
 * `aria-label` carries the full phrase, e.g. "حديث صحيح".
 */
export function GradeBadge({ grade, label, className }: GradeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        GRADE_CLASSES[grade],
        className,
      )}
      aria-label={label}
    >
      {label}
    </span>
  );
}
