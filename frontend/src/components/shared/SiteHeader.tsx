'use client';

import { useState } from 'react';
import { ChevronDown, Menu, Smartphone, X } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AuthNavItems } from './AuthNavItems';
import { currentHeaderItem, HEADER_MENU, type HeaderMenuItem, type HeaderMenuKey } from './header-menu';

/**
 * Public site header (thekra-source chrome) with ONE menu for a visitor and a member (owner round 5, W-10 a):
 * «أبواب الخير» then «للأعضاء» (`header-menu.ts`). On a wide screen «القائمة» opens a dropdown; at phone width the same
 * list opens in a side drawer from the inline-start side. «رفقة (في التطبيق)» opens a short note (W-12 b).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const tApp = useTranslations('app');
  const tNav = useTranslations('nav');
  const tTheme = useTranslations('theme');
  const tLocale = useTranslations('localeSwitcher');
  const current = currentHeaderItem(pathname);
  const [appNoteOpen, setAppNoteOpen] = useState(false);

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
        <MenuDropdown current={current} onAppNote={() => setAppNoteOpen(true)} />
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
        <MenuDrawer key={pathname} current={current} onAppNote={() => setAppNoteOpen(true)} />
      </nav>
      <AppOnlyNote open={appNoteOpen} onOpenChange={setAppNoteOpen} />
    </header>
  );
}

interface MenuProps {
  current: HeaderMenuKey | null;
  onAppNote: () => void;
}

/** The item's label: «رفقة» says where it lives («رفقة (في التطبيق)»). */
function useItemLabel() {
  const tNav = useTranslations('nav');
  return (key: HeaderMenuKey) => (key === 'circles' ? tNav('inApp', { name: tNav('menuItems.circles') }) : tNav(`menuItems.${key}`));
}

/** Wide screens: the grouped list in a dropdown (Radix: arrow keys, Escape, focus returns to the trigger). */
function MenuDropdown({ current, onAppNote }: MenuProps) {
  const tNav = useTranslations('nav');
  const label = useItemLabel();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="nav-link nav-link-primary nav-more" data-current={current ? true : undefined}>
          {tNav('menu')}
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-64 p-1.5">
        {HEADER_MENU.map((group, index) => (
          <DropdownMenuGroup key={group.key}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
              {tNav(`menuGroups.${group.key}`)}
            </DropdownMenuLabel>
            {group.items.map((item) => (
              <DropdownMenuItem
                key={item.key}
                asChild={item.href !== null}
                className="min-h-11 px-2 text-[15px]"
                onSelect={item.href === null ? onAppNote : undefined}
              >
                {item.href !== null ? (
                  <Link
                    href={item.href}
                    aria-current={current === item.key ? 'page' : undefined}
                    className={cn(current === item.key && 'text-primary-text')}
                  >
                    {label(item.key)}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2">
                    {label(item.key)}
                    <Smartphone aria-hidden className="size-4 text-muted-foreground" />
                  </span>
                )}
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
function MenuDrawer({ current, onAppNote }: MenuProps) {
  const tNav = useTranslations('nav');
  const label = useItemLabel();
  const side = useLocale() === 'en' ? 'left' : 'right';
  const [open, setOpen] = useState(false);
  const rowClass =
    'flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-start text-base transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:font-medium aria-[current=page]:text-primary-text';

  function row(item: HeaderMenuItem) {
    if (item.href === null) {
      return (
        <button
          type="button"
          className={rowClass}
          onClick={() => {
            setOpen(false);
            onAppNote();
          }}
        >
          {label(item.key)}
          <Smartphone aria-hidden className="size-4 text-muted-foreground" />
        </button>
      );
    }
    return (
      <Link href={item.href} className={rowClass} aria-current={current === item.key ? 'page' : undefined} onClick={() => setOpen(false)}>
        {label(item.key)}
      </Link>
    );
  }

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
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-5" aria-hidden />
            </button>
          </SheetClose>
        </div>
        <nav aria-label={tNav('menu')} className="flex flex-col gap-5 px-3 py-4">
          {HEADER_MENU.map((group, index) => (
            <section
              key={group.key}
              aria-labelledby={`drawer-${group.key}`}
              className={cn('flex flex-col gap-1', index > 0 && 'border-t border-border pt-4')}
            >
              <h2 id={`drawer-${group.key}`} className="px-3 text-xs font-medium text-muted-foreground">
                {tNav(`menuGroups.${group.key}`)}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.key}>{row(item)}</li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/** «رفقة» lives in the app (W-12 b): one short note, no store link until the owner publishes one. */
function AppOnlyNote({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const tNav = useTranslations('nav');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{tNav('menuItems.circles')}</DialogTitle>
          <DialogDescription className="leading-7">{tNav('circlesNote')}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
