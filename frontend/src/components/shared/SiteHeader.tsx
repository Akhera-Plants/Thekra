import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

export async function SiteHeader() {
  const tApp = await getTranslations('app');
  const tTheme = await getTranslations('theme');
  const tLocale = await getTranslations('localeSwitcher');

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="font-semibold tracking-tight text-foreground transition-[opacity,transform] duration-150 ease-out hover:opacity-90 motion-reduce:transition-none"
        >
          {tApp('name')}
        </Link>
        <nav
          className="flex items-center gap-1"
          aria-label={tApp('name')}
        >
          <LocaleSwitcher label={tLocale('label')} className="px-2 py-1" />
          <ThemeToggle
            labels={{
              toggle: tTheme('toggle'),
              light: tTheme('light'),
              dark: tTheme('dark'),
              system: tTheme('system'),
            }}
          />
        </nav>
      </div>
    </header>
  );
}
