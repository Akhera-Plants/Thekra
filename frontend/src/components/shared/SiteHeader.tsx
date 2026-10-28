'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { SavedNavLink } from '@/features/favorites/components/SavedNavLink';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AuthNavItems } from './AuthNavItems';

/**
 * Public site header (thekra-source chrome).
 * Favorites count is owned by features/SavedNavLink (shared must not fetch).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const tTheme = useTranslations('theme');
  const tLocale = useTranslations('localeSwitcher');

  const aboutCurrent = pathname === '/about' || pathname.startsWith('/about/');
  const practiceCurrent = pathname === '/practice' || pathname.startsWith('/practice/');
  const calendarCurrent = pathname === '/calendar';

  return (
    <header className="site-header page-width">
      <Link href="/" className="brand" aria-label={`${tApp('name')}, ${tNav('home')}`}>
        <svg className="brand-symbol" viewBox="0 0 32 36" fill="none" aria-hidden>
          <path
            d="M16 31V14M16 24C5 24 3 17 4 9c8 0 12 5 12 15Zm0 0c11 0 13-7 12-15-8 0-12 5-12 15Zm0-10c-5-5-5-8 0-13 5 5 5 8 0 13Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        <span className="wordmark">{tApp('name')}</span>
        <span className="brand-message">{tApp('tagline')}</span>
      </Link>

      <nav className="main-nav" aria-label={tNav('main')}>
        <Link
          href="/practice"
          className="nav-link"
          aria-current={practiceCurrent ? 'page' : undefined}
        >
          {tNav('practice')}
        </Link>
        <Link
          href="/calendar"
          className="nav-link"
          aria-current={calendarCurrent ? 'page' : undefined}
        >
          {tNav('calendar')}
        </Link>
        <Link
          href="/about"
          className="nav-link"
          aria-current={aboutCurrent ? 'page' : undefined}
        >
          {tNav('about')}
        </Link>
        <SavedNavLink />
        <span className="nav-divider" aria-hidden />
        <LocaleSwitcher label={tLocale('label')} className="nav-link" />
        <ThemeToggle
          labels={{
            toggle: tTheme('toggle'),
            light: tTheme('light'),
            dark: tTheme('dark'),
          }}
        />
        <div className="header-auth ms-1 flex items-center gap-1">
          <AuthNavItems />
        </div>
      </nav>
    </header>
  );
}
