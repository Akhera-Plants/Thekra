'use client';

import { useEffect } from 'react';
import { Menu } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AuthNavItems } from './AuthNavItems';

const NAV = [
  { href: '/', key: 'home', underline: 'bg-foreground' },
  { href: '/sins', key: 'sins', underline: 'bg-intent-sin' },
  { href: '/good-deeds', key: 'goodDeeds', underline: 'bg-intent-good-deed' },
  { href: '/branches', key: 'branches', underline: 'bg-intent-iman-branch' },
  { href: '/favorites', key: 'favorites', underline: 'bg-foreground' },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const tNav = useTranslations('nav');

  return (
    <ul className={className}>
      {NAV.map((item) => {
        const active = isCurrent(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'text-foreground',
              )}
            >
              {tNav(item.key)}
              {active && (
                <span className={cn('absolute inset-x-2 bottom-2 h-0.5', item.underline)} />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AccountActions() {
  const tTheme = useTranslations('theme');
  const tLocale = useTranslations('localeSwitcher');

  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <LocaleSwitcher label={tLocale('label')} className="px-2 py-1" />
      <ThemeToggle
        labels={{
          toggle: tTheme('toggle'),
          light: tTheme('light'),
          dark: tTheme('dark'),
          system: tTheme('system'),
        }}
      />
      <AuthNavItems />
    </div>
  );
}

export function SiteHeader() {
  const locale = useLocale();
  const pathname = usePathname();
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const home = pathname === '/';

  useEffect(() => {
    const root = document.documentElement;
    if (home) root.dataset.sky = 'home';
    else delete root.dataset.sky;
    return () => {
      delete root.dataset.sky;
    };
  }, [home]);

  return (
    <header className={cn(
      'sticky top-0 z-40 border-b',
      home ? 'border-border/40 bg-background/55 backdrop-blur-md' : 'border-border bg-background',
    )}>
      <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-3 px-4 py-2">
        <Link
          href="/"
          className={cn(
            'shrink-0 text-xl text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            locale === 'ar' ? 'font-arabic-display' : 'font-semibold',
          )}
        >
          {tApp('name')}
        </Link>

        <nav aria-label={tApp('name')} className="hidden min-w-0 md:block">
          <NavLinks className="flex items-center" />
        </nav>

        <div className="hidden shrink-0 md:block">
          <AccountActions />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label={tNav('menu')}
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent side={locale === 'ar' ? 'right' : 'left'} showCloseButton={false}>
            <SheetHeader>
              <SheetTitle className={locale === 'ar' ? 'font-arabic-display text-2xl' : undefined}>
                {tApp('name')}
              </SheetTitle>
            </SheetHeader>
            <nav aria-label={tApp('name')} className="px-2">
              <NavLinks className="flex flex-col" />
            </nav>
            <div className="mt-auto border-t border-border p-4">
              <AccountActions />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <p className="border-t border-border/60 px-4 py-2 text-center text-sm leading-relaxed text-muted-foreground">
        {tApp('intentionReminder')}
      </p>
    </header>
  );
}
