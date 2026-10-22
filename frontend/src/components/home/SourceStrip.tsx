'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import LogoLoop from '@/components/shared/react-bits/LogoLoop';

interface SourceStripProps {
  locale: 'ar' | 'en';
  /** Source names in the active locale, already ranked and de-duplicated on the server. */
  names: readonly string[];
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/**
 * Informational source wordmarks via React Bits LogoLoop.
 * Reduced motion → static complete list (CURSOR_HANDOFF).
 */
export function SourceStrip({ locale, names }: SourceStripProps) {
  const t = useTranslations('home');
  const reduceMotion = usePrefersReducedMotion();

  // Memoised so LogoLoop only re-measures when the names change, not on every render.
  const logos = useMemo(
    () =>
      names.map((name) => ({
        node: <span className="source-mark-title">{name}</span>,
        title: name,
        ariaLabel: name,
      })),
    [names],
  );

  return (
    <section className="sources-section" aria-labelledby="sources-title">
      <div className="sources-top">
        <div className="sources-heading">
          <h2 id="sources-title">{t('sourcesHeading')}</h2>
          <p>{t('sourcesLead')}</p>
        </div>
      </div>

      <p className="sr-only">{names.join(locale === 'ar' ? '، ' : ', ')}</p>

      {reduceMotion ? (
        <ul className="source-group" aria-label={t('sourcesAria')}>
          {names.map((name) => (
            <li className="source-mark" key={name}>
              <span className="source-mark-title">{name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="sources-marquee is-moving" aria-label={t('sourcesAria')} aria-hidden>
          {/* LogoLoop measures the track with left-based geometry, which needs an LTR
              track even on the RTL page. Arabic text inside still renders right-to-left. */}
          <div className="source-window" dir="ltr">
            <LogoLoop
              logos={logos}
              speed={55}
              direction={locale === 'ar' ? 'right' : 'left'}
              gap={40}
              logoHeight={48}
              fadeOut
              fadeOutColor="var(--page)"
              intro={false}
              draggable={false}
              scaleOnHover={false}
              pauseOnHover={false}
              ariaLabel={t('sourcesAria')}
            />
          </div>
        </div>
      )}
    </section>
  );
}
