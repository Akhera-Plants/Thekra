import { ArabicText } from '@/components/shared/ArabicText';
import { cn } from '@/lib/utils';

interface RewardCalloutProps {
  rewardAr: string;
  reward?: string | null;
  heading: string;
  className?: string;
}

/**
 * Prominent reward callout on the good-deed detail page.
 * Arabic content primary, translation beneath it.
 */
export function RewardCallout({
  rewardAr,
  reward,
  heading,
  className,
}: RewardCalloutProps) {
  return (
    <aside
      aria-label={heading}
      className={cn(
        'rounded-lg border border-border bg-accent/30 px-5 py-4',
        className,
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      <ArabicText size="lg">{rewardAr}</ArabicText>
      {reward && (
        <p className="mt-2 text-sm text-muted-foreground">{reward}</p>
      )}
    </aside>
  );
}
