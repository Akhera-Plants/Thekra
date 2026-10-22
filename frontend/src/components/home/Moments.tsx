import { Heart, MessageCircle, Pause, Sun, type LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';

export interface MomentLink {
  href: string;
  labelKey: 'momentAnger' | 'momentPrayer' | 'momentBackbiting' | 'momentKindness';
  icon: LucideIcon;
}

/** Curated moment links mapped to real topic slugs (not prototype sample IDs). */
export const DEFAULT_MOMENTS: MomentLink[] = [
  { href: '/sins/ghadab', labelKey: 'momentAnger', icon: Pause },
  { href: '/good-deeds/salah', labelKey: 'momentPrayer', icon: Sun },
  { href: '/sins/ghibah', labelKey: 'momentBackbiting', icon: MessageCircle },
  { href: '/good-deeds/kalam-tayyib', labelKey: 'momentKindness', icon: Heart },
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
        {moments.map((moment) => {
          const Icon = moment.icon;
          return (
            <Link key={moment.href} className="moment" href={moment.href}>
              <span className="moment-symbol">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span>{t(moment.labelKey)}</span>
              <span className="link-arrow">
                <DirectionalArrow className="size-[17px]" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
