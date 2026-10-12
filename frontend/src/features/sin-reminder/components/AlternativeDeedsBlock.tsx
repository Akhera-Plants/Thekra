import { Link } from '@/i18n/navigation';
import { CatalogName } from '@/components/shared/CatalogName';
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
      <h2 id="alternatives-heading" className="mb-3 font-arabic-display text-2xl text-intent-good-deed">
        {heading}
      </h2>
      <ul className="flex flex-col">
        {alternatives.map((deed) => (
          <li key={deed.id} className="border-b border-border">
            <Link
              href={`/good-deeds/${deed.slug}`}
              className="flex min-h-16 min-w-0 items-center py-3 text-intent-good-deed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-[transform,background-color] motion-safe:duration-200 motion-safe:hover:translate-x-1 motion-safe:hover:bg-muted/50 motion-safe:rtl:hover:-translate-x-1 motion-reduce:transition-none"
            >
              <CatalogName nameAr={deed.nameAr} name={deed.name} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
