'use client';

import { useSelectedLayoutSegment } from 'next/navigation';

/** Segments under /[locale] that bring their own product shell instead of the public chrome. */
const OWN_SHELL_SEGMENTS = new Set(['admin']);

interface SiteChromeProps {
  header: React.ReactNode;
  footer: React.ReactNode;
  skipLink: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Chooses the chrome by route segment (one level below /[locale]).
 * Public routes get the site header/footer; the admin desk renders its own shell.
 * This is a layout decision, not CSS hiding: the public chrome is not rendered at all.
 */
export function SiteChrome({ header, footer, skipLink, children }: SiteChromeProps) {
  const segment = useSelectedLayoutSegment();

  if (segment && OWN_SHELL_SEGMENTS.has(segment)) {
    return <>{children}</>;
  }

  return (
    <>
      {skipLink}
      {header}
      <main id="main-content" className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
      {footer}
    </>
  );
}
