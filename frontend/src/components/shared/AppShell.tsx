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
        <a href="#main-content" className="skip-link">
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
