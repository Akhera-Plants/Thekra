import type { SVGProps } from 'react';

/** Stroke icons from thekra-source `content.js` ICONS map. */
const PATHS = {
  arrow: <path d="M19 12H5m6-6-6 6 6 6" />,
  back: <path d="M5 12h14m-6-6 6 6-6 6" />,
  bookmark: <path d="M6 4h12v17l-6-4-6 4V4Z" />,
  moon: <path d="M20 15a8.5 8.5 0 0 1-11-11A8.5 8.5 0 1 0 20 15Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  leaf: <path d="M5 19C4 9 9 4 20 4c0 11-5 16-15 15Zm0 0L16 8" />,
  sprout: (
    <path d="M12 22V12M7 22h10M12 17C4 17 2 12 3 5c7 0 9 5 9 12Zm0-5c0-7 4-10 10-10 0 7-3 10-10 10Z" />
  ),
  door: <path d="M5 22V10a7 7 0 0 1 14 0v12M3 22h18M8 22V11a4 4 0 0 1 4-4v15M10 14v2" />,
  book: (
    <path d="M12 5C8 2 4 3 2 4v16c3-1 6-1 10 2m0-17c4-3 8-2 10-1v16c-3-1-6-1-10 2V5Z" />
  ),
  quran: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M7 2v20m4-15 5 4-5 4-2-4 2-4Zm-1 12h7" />
    </>
  ),
  pause: (
    <>
      <path d="M9 6v12M15 6v12" />
      <circle cx="12" cy="12" r="10" />
    </>
  ),
  message: (
    <>
      <path d="M20 15a8 8 0 0 1-8 5H4l1-5a8 8 0 1 1 15 0Z" />
      <path d="M8 10h8m-8 4h5" />
    </>
  ),
  heart: (
    <path d="M20.5 4.5a5.5 5.5 0 0 0-8.5 1 5.5 5.5 0 0 0-8.5 7C5.5 16 12 21 12 21s6.5-5 8.5-8.5a5.5 5.5 0 0 0 0-8Z" />
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  share: <path d="M12 16V2m-5 5 5-5 5 5M6 10H3v12h18V10h-3" />,
  check: <path d="m5 12 4 4L19 6" />,
  external: <path d="M14 3h7v7M21 3 10 14M9 3H3v18h18v-6" />,
  hand: <path d="M3 17h3l3 4h7l6-6-1-2-7 4H9m-3 0V9H2m4 5 3-4h5l3 3-1 2h-5" />,
  shield: (
    <>
      <path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  prayer: (
    <>
      <path d="M5 22V11l7-9 7 9v11H5Z" />
      <path d="M8 22V12l4-5 4 5v10M3 22h18" />
    </>
  ),
  path: <path d="M4 22c0-8 12-5 12-11s-5-3-5-9M8 22c0-7 12-3 12-11S15 6 15 2" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 9h.01M16 9h.01M7 14c2 4 8 4 10 0" />
    </>
  ),
} as const;

export type SiteIconName = keyof typeof PATHS;

export function SiteIcon({
  name,
  className,
  ...props
}: { name: SiteIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
