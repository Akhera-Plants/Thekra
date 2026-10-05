import { cn } from '@/lib/utils';
import type { GoodDeedDto } from '@/lib/types/api';
import { ArabicText } from '@/components/shared/ArabicText';

interface GoodDeedHeaderProps {
  goodDeed: Pick<
    GoodDeedDto,
    'name' | 'nameAr' | 'descriptionAr' | 'description'
  >;
  className?: string;
}

export function GoodDeedHeader({ goodDeed, className }: GoodDeedHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      <ArabicText as="h1" size="xl" className="font-semibold">
        {goodDeed.nameAr}
      </ArabicText>
      {goodDeed.name && (
        <span className="text-sm text-muted-foreground">{goodDeed.name}</span>
      )}
      {goodDeed.descriptionAr && (
        <ArabicText size="base" className="text-muted-foreground">
          {goodDeed.descriptionAr}
        </ArabicText>
      )}
      {!goodDeed.descriptionAr && goodDeed.description && (
        <p className="text-sm text-muted-foreground">{goodDeed.description}</p>
      )}
    </header>
  );
}
