import { cn } from '@/lib/utils';
import type { SinDto } from '@/lib/types/api';
import { ArabicText } from '@/components/shared/ArabicText';
import { SinRankBadge } from '@/components/shared/SinRankBadge';

interface SinHeaderProps {
  sin: Pick<SinDto, 'name' | 'nameAr' | 'rank' | 'descriptionAr' | 'description'>;
  /** Translated كبيرة / صغيرة. Omitted when the sin has no rank. */
  rankLabel?: string;
  className?: string;
}

export function SinHeader({ sin, rankLabel, className }: SinHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      <ArabicText as="h1" size="xl" className="font-semibold">
        {sin.nameAr}
      </ArabicText>
      <div className="flex flex-wrap items-center gap-2">
        {sin.name && (
          <span className="text-sm text-muted-foreground">{sin.name}</span>
        )}
        {sin.rank && rankLabel && (
          <SinRankBadge rank={sin.rank} label={rankLabel} />
        )}
      </div>
      {sin.descriptionAr && (
        <ArabicText size="base" className="text-muted-foreground">
          {sin.descriptionAr}
        </ArabicText>
      )}
      {!sin.descriptionAr && sin.description && (
        <p className="text-sm text-muted-foreground">{sin.description}</p>
      )}
    </header>
  );
}
