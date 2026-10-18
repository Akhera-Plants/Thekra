'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import LogoLoop from '@/components/shared/react-bits/LogoLoop';

const SOURCE_NAMES_AR = [
  'القرآن الكريم',
  'صحيح البخاري',
  'صحيح مسلم',
  'رياض الصالحين',
  'الفوائد',
] as const;

const SOURCE_NAMES_EN = [
  'The Noble Quran',
  'Sahih al-Bukhari',
  'Sahih Muslim',
  'Riyad as-Salihin',
  'Al-Fawaid',
] as const;

interface SourceStripProps {
  locale: 'ar' | 'en';
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
export function SourceStrip({ locale }: SourceStripProps) {
  const t = useTranslations('home');
  const names = locale === 'en' ? SOURCE_NAMES_EN : SOURCE_NAMES_AR;
  const reduceMotion = usePrefersReducedMotion();

  const logos = names.map((name) => ({
    node: <span className="source-mark-title">{name}</span>,
    title: name,
    ariaLabel: name,
  }));

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
          <div className="source-window">
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
