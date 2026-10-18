'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

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

/**
 * Informational source marquee. Ports setupSourceStrip(): only fully-visible
 * wordmarks are shown while moving; reduced-motion gets a static list.
 */
export function SourceStrip({ locale }: SourceStripProps) {
  const t = useTranslations('home');
  const names = locale === 'en' ? SOURCE_NAMES_EN : SOURCE_NAMES_AR;
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const viewport = strip.querySelector<HTMLElement>('.source-window');
    if (!viewport) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    function stop() {
      if (frame && window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
      frame = 0;
    }

    function marks() {
      return [...strip!.querySelectorAll<HTMLElement>('.source-mark')];
    }

    function measure() {
      const bounds = viewport!.getBoundingClientRect();
      const items = marks();
      const states = items.map((mark) => {
        const box = mark.getBoundingClientRect();
        return String(box.left >= bounds.left + 8 && box.right <= bounds.right - 8);
      });
      items.forEach((mark, index) => {
        if (mark.dataset.full !== states[index]) mark.dataset.full = states[index];
      });
    }

    function tick() {
      measure();
      frame = window.requestAnimationFrame(tick);
    }

    function sync() {
      stop();
      strip!.classList.remove('is-moving');
      marks().forEach((mark) => mark.removeAttribute('data-full'));
      if (media.matches || !window.requestAnimationFrame) return;
      if (viewport!.getBoundingClientRect().width <= 0) return;
      strip!.classList.add('is-moving');
      measure();
      frame = window.requestAnimationFrame(tick);
    }

    function onVisibility() {
      if (document.hidden) {
        strip!.dataset.inactive = 'true';
        stop();
      } else {
        delete strip!.dataset.inactive;
        sync();
      }
    }

    sync();
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', sync);

    return () => {
      stop();
      media.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', sync);
    };
  }, [locale]);

  const group = (hidden: boolean, key: string) => (
    <ul className="source-group" aria-hidden={hidden || undefined} key={key}>
      {names.map((name) => (
        <li className="source-mark" key={`${key}-${name}`}>
          <span className="source-mark-title">{name}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="sources-section" aria-labelledby="sources-title">
      <div className="sources-top">
        <div className="sources-heading">
          <h2 id="sources-title">{t('sourcesHeading')}</h2>
          <p>{t('sourcesLead')}</p>
        </div>
      </div>
      <div className="sources-marquee" ref={stripRef} aria-label={t('sourcesAria')}>
        <p className="sr-only">{names.join('، ')}</p>
        <div className="source-window" aria-hidden>
          <div className="source-track">
            {group(false, 'a')}
            {group(true, 'b')}
          </div>
        </div>
      </div>
    </section>
  );
}
