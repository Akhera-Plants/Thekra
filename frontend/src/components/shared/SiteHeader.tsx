import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AuthNavItems } from './AuthNavItems';

export async function SiteHeader() {
  const tApp = await getTranslations('app');
  const tTheme = await getTranslations('theme');
  const tLocale = await getTranslations('localeSwitcher');
  const tNav = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="font-semibold tracking-tight text-foreground transition-[opacity,transform] duration-150 ease-out hover:opacity-90 motion-reduce:transition-none"
        >
          {tApp('name')}
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-1 sm:flex" aria-label={tApp('name')}>
          <Link
            href="/favorites"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tNav('favorites')}
          </Link>
        </nav>

        <div className="flex items-center gap-1">
          <LocaleSwitcher label={tLocale('label')} className="px-2 py-1" />
          <ThemeToggle
            labels={{
              toggle: tTheme('toggle'),
              light: tTheme('light'),
              dark: tTheme('dark'),
              system: tTheme('system'),
            }}
          />
          {/* Auth items rendered client-side (session-aware) */}
          <AuthNavItems />
        </div>
      </div>
    </header>
  );
}
