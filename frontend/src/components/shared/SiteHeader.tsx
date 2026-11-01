'use client';

import { useState, useSyncExternalStore } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AuthNavItems } from './AuthNavItems';
import { useSession } from '@/features/auth/hooks/useSession';
import { currentMemberItem, isInMore, MEMBER_MORE, MEMBER_PRIMARY, type MemberNavKey } from './member-nav';

const noSubscribe = () => () => {};

/** Signed in, and known to be: false during the server render and while the session is restored. */
function useIsMember(): boolean {
  const { isAuthenticated, isLoading } = useSession();
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  return mounted && !isLoading && isAuthenticated;
}

/**
 * Public site header (thekra-source chrome). A guest sees no links: the home is «أبواب الخير» itself (the logo), and
 * «تسجيل الدخول» is the header's action. A member sees «ورد اليوم» · «عاداتي» · «المزيد» (see `member-nav.ts`); at phone
 * width these fold into a side drawer that opens from the inline-start side.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const tTheme = useTranslations('theme');
  const tLocale = useTranslations('localeSwitcher');
  const isMember = useIsMember();
  const current = currentMemberItem(pathname);

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
        {isMember ? (
          <>
            {MEMBER_PRIMARY.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="nav-link nav-link-primary"
                aria-current={current === item.key ? 'page' : undefined}
              >
                {tNav(item.key === 'wird' ? 'practice' : item.key)}
              </Link>
            ))}
            <MoreMenu current={current} />
            <span className="nav-divider" aria-hidden />
          </>
        ) : null}
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
        {isMember ? <MemberDrawer key={pathname} current={current} /> : null}
      </nav>
    </header>
  );
}

function useItemLabel() {
  const tNav = useTranslations('nav');
  return (key: MemberNavKey) => tNav(key === 'wird' ? 'practice' : key);
}

/** «المزيد» on desktop: the grouped list in a dropdown menu (Radix: arrow keys, Escape, focus returns to the trigger). */
function MoreMenu({ current }: { current: MemberNavKey | null }) {
  const tNav = useTranslations('nav');
  const label = useItemLabel();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="nav-link nav-link-primary nav-more" data-current={isInMore(current) || undefined}>
          {tNav('more')}
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-60 p-1.5">
        {MEMBER_MORE.map((group, index) => (
          <DropdownMenuGroup key={group.key}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
              {tNav(`groups.${group.key}`)}
            </DropdownMenuLabel>
            {group.items.map((item) => (
              <DropdownMenuItem key={item.key} asChild className="min-h-10 px-2 text-[15px]">
                <Link
                  href={item.href}
                  aria-current={current === item.key ? 'page' : undefined}
                  className={cn(current === item.key && 'text-primary')}
                >
                  {label(item.key)}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Phones: «القائمة» opens a drawer from the inline-start side (right in Arabic, left in English). Radix Dialog traps
 * focus, closes on Escape and on the overlay, and returns focus to the button. A new page closes it (keyed by path).
 */
function MemberDrawer({ current }: { current: MemberNavKey | null }) {
  const tNav = useTranslations('nav');
  const label = useItemLabel();
  const side = useLocale() === 'en' ? 'left' : 'right';
  const [open, setOpen] = useState(false);
  const linkClass =
    'flex min-h-12 items-center rounded-lg px-3 text-base transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:font-medium aria-[current=page]:text-primary';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="nav-link menu-toggle">
          <Menu className="size-5" aria-hidden />
          <span className="menu-toggle-label">{tNav('menu')}</span>
        </button>
      </SheetTrigger>
      <SheetContent side={side} showCloseButton={false} aria-describedby={undefined} className="gap-0 overflow-y-auto p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <SheetTitle className="text-lg">{tNav('menu')}</SheetTitle>
          <SheetClose asChild>
            <button
              type="button"
              aria-label={tNav('close')}
              className="inline-flex size-10 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-5" aria-hidden />
            </button>
          </SheetClose>
        </div>
        <nav aria-label={tNav('menu')} className="flex flex-col gap-5 px-3 py-4">
          <ul className="flex flex-col gap-0.5">
            {MEMBER_PRIMARY.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={cn(linkClass, 'text-lg')} aria-current={current === item.key ? 'page' : undefined} onClick={() => setOpen(false)}>
                  {label(item.key)}
                </Link>
              </li>
            ))}
          </ul>
          {MEMBER_MORE.map((group) => (
            <section key={group.key} aria-labelledby={`drawer-${group.key}`} className="flex flex-col gap-1 border-t border-border pt-4">
              <h2 id={`drawer-${group.key}`} className="px-3 text-xs font-medium text-muted-foreground">
                {tNav(`groups.${group.key}`)}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className={linkClass} aria-current={current === item.key ? 'page' : undefined} onClick={() => setOpen(false)}>
                      {label(item.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
