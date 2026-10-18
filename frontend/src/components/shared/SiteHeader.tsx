'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { SiteIcon } from '@/components/shared/site-icons';
import { useFavoriteQuoteIds } from '@/features/favorites/hooks/useFavoriteQuoteIds';
import { useSession } from '@/features/auth/hooks/useSession';
import { formatDigits } from '@/lib/format/digits';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AuthNavItems } from './AuthNavItems';

function FavoritesCount() {
  const { isAuthenticated } = useSession();
  const { ids } = useFavoriteQuoteIds();
  if (!isAuthenticated || ids.size === 0) return null;
  return <span className="saved-count">{formatDigits(ids.size)}</span>;
}

export function SiteHeader() {
  const locale = useLocale();
  const pathname = usePathname();
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const tTheme = useTranslations('theme');
  const tLocale = useTranslations('localeSwitcher');

  const aboutCurrent = pathname === '/about' || pathname.startsWith('/about/');
  const favoritesCurrent = pathname === '/favorites' || pathname.startsWith('/favorites/');

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
          href="/about"
          className="nav-link"
          aria-current={aboutCurrent ? 'page' : undefined}
        >
          {tNav('about')}
        </Link>
        <Link
          href="/favorites"
          className="nav-link saved-nav"
          aria-current={favoritesCurrent ? 'page' : undefined}
        >
          <SiteIcon name="bookmark" />
          <span>{tNav('favorites')}</span>
          <FavoritesCount />
        </Link>
        <span className="nav-divider" aria-hidden />
        <LocaleSwitcher label={tLocale('label')} className="nav-link" />
        <ThemeToggle
          labels={{
            toggle: tTheme('toggle'),
            light: tTheme('light'),
            dark: tTheme('dark'),
          }}
        />
        <div className="ms-1 flex items-center gap-1" data-locale={locale}>
          <AuthNavItems />
        </div>
      </nav>
    </header>
  );
}
