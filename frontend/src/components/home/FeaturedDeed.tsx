import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteIcon } from '@/components/shared/site-icons';

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
          {t('deedCardCta')} <SiteIcon name="arrow" />
        </span>
      </div>
      <svg className="olive-drawing" viewBox="0 0 112 170" fill="none" aria-hidden>
        <path
          d="M23 159c15-30 35-76 51-143M47 103c-25-1-34-17-30-36 19 2 32 19 30 36Zm11-30c-18-7-25-25-20-43 17 5 27 21 20 43Zm12-32c-9-8-10-23-3-35 11 10 12 24 3 35ZM38 124c25 9 48-2 57-20-22-7-43 0-57 20Zm17-37c22 4 40-8 45-28-21 0-37 8-45 28Zm12-37c19-1 30-13 31-31-18 4-28 15-31 31Z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    </Link>
  );
}
