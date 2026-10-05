import { Link } from '@/i18n/navigation';
import { ArabicText } from '@/components/shared/ArabicText';
import type { GoodDeedSummaryDto } from '@/lib/types/api';

interface AlternativeDeedsBlockProps {
  alternatives: GoodDeedSummaryDto[];
  heading: string;
}

/**
 * Shows the constructive alternatives (good deeds) linked from the sin detail.
 * Presentational — receives data as props, does not fetch.
 */
export function AlternativeDeedsBlock({
  alternatives,
  heading,
}: AlternativeDeedsBlockProps) {
  if (alternatives.length === 0) return null;

  return (
    <section aria-labelledby="alternatives-heading" className="mt-6">
      <h2
        id="alternatives-heading"
        className="mb-3 text-lg font-semibold text-foreground"
      >
        {heading}
      </h2>
      <ul className="flex flex-col gap-2">
        {alternatives.map((deed) => (
          <li key={deed.id}>
            <Link
              href={`/good-deeds/${deed.slug}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-[opacity] duration-150 ease-out hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <ArabicText as="span" size="base">
                {deed.nameAr}
              </ArabicText>
              {deed.name && (
                <span className="shrink-0 text-sm text-muted-foreground">
                  {deed.name}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
