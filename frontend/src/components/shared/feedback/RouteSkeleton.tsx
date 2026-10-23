'use client';

import { useTranslations } from 'next-intl';
import { BrandLoader } from './BrandLoader';

type Variant = 'catalog' | 'reader' | 'detail' | 'list' | 'plain';

interface RouteSkeletonProps {
  /** Shapes the placeholder like the page: catalogue (search + two-column rows), reader (chips + reminders), detail (one text), list, plain (text page). */
  variant?: Variant;
  /** Show the breadcrumb strip (public pages with breadcrumbs). */
  crumbs?: boolean;
}

const lines = (count: number, widths: string[]) =>
  Array.from({ length: count }, (_, index) => (
    <span
      key={index}
      className="skeleton"
      data-shape="line"
      style={{ inlineSize: widths[index % widths.length] }}
    />
  ));

/**
 * Body of every route `loading.tsx` (a client component: a loading file has no `params`,
 * and reading the locale on the server would make the static shell dynamic): the brand loader (with a localised label for
 * screen readers) above calm blocks shaped like the page that is coming. It sits in
 * the same page frame as the real pages, so the header and footer never move.
 */
export function RouteSkeleton({ variant = 'plain', crumbs = true }: RouteSkeletonProps) {
  const t = useTranslations('feedback');
  return (
    <div className="page-width inner-page route-loading" aria-busy="true" data-route-loading>
      {crumbs ? <span className="skeleton" data-shape="line" style={{ inlineSize: '12rem' }} /> : null}

      <div className="skeleton-stack">
        <span className="skeleton" data-shape="line" style={{ inlineSize: '5rem' }} />
        <span className="skeleton" data-shape="title" />
        {lines(2, ['min(40rem, 90%)', 'min(28rem, 70%)'])}
      </div>

      <div className="route-loading__status">
        <BrandLoader label={t('loadingPage')} size="page" />
      </div>

      {variant === 'catalog' ? (
        <>
          <span className="skeleton" data-shape="search" />
          <div className="skeleton-grid">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} className="skeleton" data-shape="row" />
            ))}
          </div>
        </>
      ) : null}

      {variant === 'reader' ? (
        <>
          <div className="skeleton-row-group">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className="skeleton" data-shape="chip" />
            ))}
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="skeleton-stack">
              {lines(3, ['100%', '92%', '60%'])}
            </div>
          ))}
        </>
      ) : null}

      {variant === 'detail' ? (
        <div className="skeleton-stack">{lines(5, ['100%', '96%', '88%', '94%', '50%'])}</div>
      ) : null}

      {variant === 'list' ? (
        <div className="skeleton-stack">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton-stack">
              {lines(3, ['100%', '90%', '55%'])}
            </div>
          ))}
        </div>
      ) : null}

      {variant === 'plain' ? <div className="skeleton-stack">{lines(6, ['100%', '94%', '97%', '70%'])}</div> : null}
    </div>
  );
}
