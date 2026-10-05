import { Link } from '@/i18n/navigation';
import { ArabicText } from '@/components/shared/ArabicText';
import type { GoodDeedDto } from '@/lib/types/api';

interface OppositeSinLinkProps {
  oppositeSin: NonNullable<GoodDeedDto['oppositeSin']>;
  label: string;
}

/** Link to the sin that is the "opposite" of this good deed. */
export function OppositeSinLink({ oppositeSin, label }: OppositeSinLinkProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{label}:</span>
      <Link
        href={`/sins/${oppositeSin.slug}`}
        className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArabicText as="span" size="sm">
          {oppositeSin.nameAr}
        </ArabicText>
      </Link>
    </div>
  );
}
