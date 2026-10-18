import { getTranslations } from 'next-intl/server';
import { SiteChrome } from './SiteChrome';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * App-wide visual shell: skip-to-content link, sticky SiteHeader, main wrapper.
 * Wired into [locale]/layout.tsx so every public route gets consistent chrome.
 * SiteChrome leaves it out for segments with their own shell (the admin desk).
 */
export async function AppShell({ children }: AppShellProps) {
  const t = await getTranslations('nav');

  return (
    <SiteChrome
      skipLink={
        // Skip link — visible only when focused by keyboard
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {t('skipToContent')}
        </a>
      }
      header={<SiteHeader />}
      footer={<SiteFooter />}
    >
      {children}
    </SiteChrome>
  );
}
