import { Heart, MessageCircle, Pause, Sparkles, Sun, type LucideIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { MomentLink } from './MomentLink';
import { DirectionalArrow } from '@/components/shared/DirectionalArrow';
import type { HomeMoment } from '@/lib/api/home-moments';

/** The API's icon keys (backend `home-moments.yaml`); an unknown key gets a neutral mark. */
const ICONS: Record<string, LucideIcon> = {
  pause: Pause,
  sun: Sun,
  'message-circle': MessageCircle,
  heart: Heart,
};

interface MomentsProps {
  moments: readonly HomeMoment[];
}

/**
 * «في لحظات مثل هذه» (round 6, C-09): the list comes from the API, the same for every user and edited by us; each row
 * is phrased as help («تعينك على التخفّف من الغضب») with its situation under it, and opens its topic page.
 */
export async function Moments({ moments }: MomentsProps) {
  const t = await getTranslations('home');
  if (moments.length === 0) return null;

  return (
    <section className="moments-section" aria-labelledby="moments-title">
      <div className="section-side-heading">
        <h2 id="moments-title">{t('momentsHeading')}</h2>
        <p>{t('momentsLead')}</p>
      </div>
      <div className="moments-list">
        {moments.map((moment) => {
          const Icon = ICONS[moment.icon] ?? Sparkles;
          return (
            <MomentLink key={moment.key} className="moment" moment={moment}>
              <span className="moment-symbol">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="moment-copy">
                <span>{moment.label}</span>
                {moment.situation ? <small>{moment.situation}</small> : null}
              </span>
              <span className="link-arrow">
                <DirectionalArrow className="size-[17px]" />
              </span>
            </MomentLink>
          );
        })}
      </div>
    </section>
  );
}
