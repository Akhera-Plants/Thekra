import { cn } from '@/lib/utils';

interface BrandLoaderProps {
  /** Localised, e.g. `t('loading')`. Read aloud; shown as text on the page loader and when motion is off. */
  label: string;
  /** `inline` suits buttons, chips and list headers; `page` is the centred route loader. */
  size?: 'inline' | 'page';
  /** Always show the label next to the inline mark. */
  showLabel?: boolean;
  className?: string;
}

/**
 * The favicon leaf drawn stroke by stroke (CSS only; still when the visitor
 * prefers reduced motion, where the label text says "busy" instead). No
 * left/right anywhere, so it mirrors with the document direction.
 */
export function BrandLoader({ label, size = 'inline', showLabel = false, className }: BrandLoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-size={size}
      data-label={showLabel ? 'visible' : undefined}
      className={cn('brand-loader', className)}
    >
      {size === 'page' ? (
        <svg className="brand-loader__mark" viewBox="0 0 48 48" aria-hidden focusable="false">
          <rect className="brand-loader__tile" width="48" height="48" rx="12" />
          <Leaf />
        </svg>
      ) : (
        <svg className="brand-loader__mark" viewBox="8 2 32 38" aria-hidden focusable="false">
          <Leaf />
        </svg>
      )}
      <span className="brand-loader__label">{label}</span>
    </span>
  );
}

/** The favicon's four strokes, split so each can draw in turn (pathLength=1 normalises the dash). */
function Leaf() {
  return (
    <>
      <path className="brand-loader__leaf" pathLength={1} d="M24 37V18" />
      <path className="brand-loader__leaf" pathLength={1} d="M24 30C13 30 11 23 12 15c8 0 12 5 12 15Z" />
      <path className="brand-loader__leaf" pathLength={1} d="M24 30c11 0 13-7 12-15-8 0-12 5-12 15Z" />
      <path className="brand-loader__leaf" pathLength={1} d="M24 18c-5-5-5-8 0-13 5 5 5 8 0 13Z" />
    </>
  );
}
