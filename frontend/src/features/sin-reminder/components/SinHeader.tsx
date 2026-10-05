import { cn } from '@/lib/utils';
import type { SinDto } from '@/lib/types/api';
import { ArabicText } from '@/components/shared/ArabicText';

interface SinHeaderProps {
  sin: Pick<
    SinDto,
    'name' | 'nameAr' | 'severity' | 'descriptionAr' | 'description'
  >;
  severityLabel: string;
  className?: string;
}

export function SinHeader({ sin, severityLabel, className }: SinHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      <ArabicText as="h1" size="xl" className="font-semibold">
        {sin.nameAr}
      </ArabicText>
      <div className="flex flex-wrap items-center gap-2">
        {sin.name && (
          <span className="text-sm text-muted-foreground">{sin.name}</span>
        )}
        {sin.severity !== null && sin.severity !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {severityLabel}: <bdi>{sin.severity}</bdi>/10
          </span>
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
