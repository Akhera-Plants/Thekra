import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';

export interface FeaturedDeedData {
  slug: string;
  name: string;
  line: string | null;
}

interface FeaturedDeedProps {
  deed: FeaturedDeedData;
}

/** Entire card is one Link — CTA is a styled span (CURSOR_HANDOFF). */
export async function FeaturedDeed({ deed }: FeaturedDeedProps) {
  const t = await getTranslations('home');

  return (
    <Link
      className="good-deed"
      href={`/good-deeds/${deed.slug}`}
      aria-labelledby="featured-deed-title"
      aria-describedby={deed.line ? 'featured-deed-summary' : undefined}
    >
      <div className="good-deed-copy">
        <p className="eyebrow">{t('deedCardEyebrow')}</p>
        <h2 id="featured-deed-title">{deed.name}</h2>
        {deed.line ? <p id="featured-deed-summary">{deed.line}</p> : null}
        <span className="card-action">
          {t('deedCardCta')} <DirectionalArrow className="size-[18px]" />
        </span>
      </div>
    </Link>
  );
}
