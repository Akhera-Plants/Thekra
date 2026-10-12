import { getTranslations } from 'next-intl/server';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * App-wide visual shell: skip-to-content link, sticky SiteHeader, main wrapper.
 * Wired into [locale]/layout.tsx so every route gets consistent chrome.
 */
export async function AppShell({ children }: AppShellProps) {
  const t = await getTranslations('nav');

  return (
    <>
      {/* Skip link — visible only when focused by keyboard */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {t('skipToContent')}
      </a>
      <SiteHeader />
      <main id="main-content" className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
