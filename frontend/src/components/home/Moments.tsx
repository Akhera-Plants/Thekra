import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SiteIcon, type SiteIconName } from '@/components/shared/site-icons';

export interface MomentLink {
  href: string;
  labelKey: 'momentAnger' | 'momentPrayer' | 'momentBackbiting' | 'momentKindness';
  icon: SiteIconName;
}

/** Curated moment links mapped to real topic slugs (not prototype sample IDs). */
export const DEFAULT_MOMENTS: MomentLink[] = [
  { href: '/sins/ghadab', labelKey: 'momentAnger', icon: 'pause' },
  { href: '/good-deeds/salah', labelKey: 'momentPrayer', icon: 'sun' },
  { href: '/sins/ghibah', labelKey: 'momentBackbiting', icon: 'message' },
  { href: '/good-deeds/kalam-tayyib', labelKey: 'momentKindness', icon: 'heart' },
];

interface MomentsProps {
  moments?: MomentLink[];
}

export async function Moments({ moments = DEFAULT_MOMENTS }: MomentsProps) {
  const t = await getTranslations('home');

  return (
    <section className="moments-section" aria-labelledby="moments-title">
      <div className="section-side-heading">
        <h2 id="moments-title">{t('momentsHeading')}</h2>
        <p>{t('momentsLead')}</p>
      </div>
      <div className="moments-list">
        {moments.map((moment) => (
          <Link key={moment.href} className="moment" href={moment.href}>
            <span className="moment-symbol">
              <SiteIcon name={moment.icon} />
            </span>
            <span>{t(moment.labelKey)}</span>
            <span className="link-arrow">
              <SiteIcon name="arrow" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
