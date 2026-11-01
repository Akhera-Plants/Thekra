'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AuthNavItems } from './AuthNavItems';
import { useSession } from '@/features/auth/hooks/useSession';

const noSubscribe = () => () => {};

/**
 * The member's places: «ورد اليوم» · «السجل» (practice is for members, owner 2026-11-01). A guest has none: the home is
 * «أبواب الخير» itself (the logo), and «تسجيل الدخول» is the header's action. Empty until the session is known.
 */
function useMemberLinks() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const { isAuthenticated, isLoading } = useSession();
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!mounted || isLoading || !isAuthenticated) return [];
  const recordCurrent = pathname === '/practice/record';
  return [
    {
      key: 'wird',
      href: '/practice',
      label: tNav('practice'),
      current: !recordCurrent && (pathname === '/practice' || pathname.startsWith('/practice/')),
    },
    { key: 'record', href: '/practice/record', label: tNav('record'), current: recordCurrent },
  ];
}

/**
 * Public site header (thekra-source chrome): the member's places (see {@link useMemberLinks}), then language, theme and the account
 * menu. At phone width the links fold into «القائمة», a disclosure button with the same links.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const tTheme = useTranslations('theme');
  const tLocale = useTranslations('localeSwitcher');
  const links = useMemberLinks();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // A new page closes the menu (adjusting state while rendering, not in an effect).
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
        {links.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            className="nav-link nav-link-primary"
            aria-current={link.current ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
        {links.length > 0 ? <span className="nav-divider" aria-hidden /> : null}
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
        {links.length > 0 ? (
          <button
            type="button"
            className="nav-link menu-toggle"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            <span className="menu-toggle-label">{tNav('menu')}</span>
          </button>
        ) : null}
      </nav>

      <div id={menuId} className="mobile-menu" hidden={!menuOpen}>
        <nav aria-label={tNav('menu')}>
          <ul>
            {links.map((link) => (
              <li key={link.key}>
                <Link
                  href={link.href}
                  className="mobile-menu-link"
                  aria-current={link.current ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mobile-menu-auth">
          <AuthNavItems />
        </div>
      </div>
    </header>
  );
}
