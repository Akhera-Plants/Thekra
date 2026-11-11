'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, Smartphone, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AppStoreLinks } from './AppStoreLinks';
import { AuthNavItems } from './AuthNavItems';
import { currentHeaderItem, HEADER_LINKS, HEADER_MORE, isMoreCurrent, type HeaderMenuItem, type HeaderMenuKey } from './header-menu';

/**
 * Public site header (owner round 6, C-07 b): the brand, then the links «الرئيسية · الطاعات · تخفّف من ذنب · شعب
 * الإيمان · عاداتي», then «المزيد ▾» (الاستراتيجيات، المحفوظات، «صحبة (في التطبيق)»), then language, theme and the
 * account (C-05 a: the settings live only in the account avatar menu). «المزيد» opens on hover, on click and from the
 * keyboard. Below the wide layout the same items open in a side drawer from the inline-start side. «صحبة» opens a
 * short note that it lives in the app (W-12 b; round 8: what it is now, store links, a close button).
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
        <ul className="header-links">
          {HEADER_LINKS.map((entry) => (
            <li key={entry.key}>
              <Link
                href={entry.href ?? '/'}
                className="nav-link header-link"
                aria-current={current === entry.key ? 'page' : undefined}
              >
                {tNav(`menuItems.${entry.key}`)}
              </Link>
            </li>
          ))}
          <li>
            <MoreMenu current={current} onAppNote={() => setAppNoteOpen(true)} />
          </li>
        </ul>
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

/** The item's label: «صحبة» says where it lives («صحبة (في التطبيق)»). */
function useItemLabel() {
  const tNav = useTranslations('nav');
  return (key: HeaderMenuKey) => (key === 'circles' ? tNav('inApp', { name: tNav('menuItems.circles') }) : tNav(`menuItems.${key}`));
}

/** Hover leaves the trigger or the list for this long before the list closes (time to cross the gap). */
const HOVER_CLOSE_MS = 180;

/**
 * «المزيد ▾» (C-07 b): a Radix menu (arrow keys, Escape, focus back to the trigger) that also opens on hover with a
 * mouse. A click while the hover has it open keeps it open (the click «pins» it); a second click closes it.
 */
function MoreMenu({ current, onAppNote }: MenuProps) {
  const tNav = useTranslations('nav');
  const label = useItemLabel();
  const [open, setOpen] = useState(false);
  const byHover = useRef(false);
  /** A click that pinned the hover-opened list: the close requests of that same click are ignored until then. */
  const pinnedUntil = useRef(0);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => cancelClose, []);

  const hoverOpen = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    cancelClose();
    if (!open) {
      byHover.current = true;
      setOpen(true);
    }
  };
  const hoverClose = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse' || !byHover.current) return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      byHover.current = false;
    }, HOVER_CLOSE_MS);
  };

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        cancelClose();
        // A click on the trigger while the hover opened the list pins it instead of closing it (Radix may ask to close
        // twice for that one press: the trigger's toggle and the outside-press of the open list).
        if (!next && byHover.current) {
          byHover.current = false;
          pinnedUntil.current = Date.now() + 400;
          return;
        }
        if (!next && Date.now() < pinnedUntil.current) return;
        byHover.current = false;
        setOpen(next);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="nav-link nav-more header-link"
          data-current={isMoreCurrent(current) ? true : undefined}
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
        >
          {tNav('more')}
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-60 p-1.5"
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        // Closed by the mouse leaving: the focus does not jump back to the trigger.
        onCloseAutoFocus={(event) => {
          if (closeTimer.current !== null || byHover.current) event.preventDefault();
        }}
      >
        {HEADER_MORE.map((entry) => (
          <DropdownMenuItem
            key={entry.key}
            asChild={entry.href !== null}
            className="min-h-11 px-2.5 text-[15px]"
            onSelect={entry.href === null ? onAppNote : undefined}
          >
            {entry.href !== null ? (
              <Link
                href={entry.href}
                aria-current={current === entry.key ? 'page' : undefined}
                className={cn(current === entry.key && 'text-primary-text')}
              >
                {label(entry.key)}
              </Link>
            ) : (
              <span className="flex items-center gap-2">
                {label(entry.key)}
                <Smartphone aria-hidden className="size-4 text-muted-foreground" />
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Narrow screens: «القائمة» opens a drawer from the inline-start side (right in Arabic, left in English) with the same
 * links and, under «المزيد», the same items. Radix Dialog traps focus, closes on Escape and on the overlay, and returns
 * focus to the button. A new page closes it (keyed by path).
 */
function MenuDrawer({ current, onAppNote }: MenuProps) {
  const tNav = useTranslations('nav');
  const label = useItemLabel();
  const side = useLocale() === 'en' ? 'left' : 'right';
  const [open, setOpen] = useState(false);
  const rowClass =
    'flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-start text-base transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:font-medium aria-[current=page]:text-primary-text';

  function row(entry: HeaderMenuItem) {
    if (entry.href === null) {
      return (
        <button
          type="button"
          className={rowClass}
          onClick={() => {
            setOpen(false);
            onAppNote();
          }}
        >
          {label(entry.key)}
          <Smartphone aria-hidden className="size-4 text-muted-foreground" />
        </button>
      );
    }
    return (
      <Link href={entry.href} className={rowClass} aria-current={current === entry.key ? 'page' : undefined} onClick={() => setOpen(false)}>
        {label(entry.key)}
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
          <ul className="flex flex-col gap-0.5">
            {HEADER_LINKS.map((entry) => (
              <li key={entry.key}>{row(entry)}</li>
            ))}
          </ul>
          <section aria-labelledby="drawer-more" className="flex flex-col gap-1 border-t border-border pt-4">
            <h2 id="drawer-more" className="px-3 text-xs font-medium text-muted-foreground">
              {tNav('more')}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {HEADER_MORE.map((entry) => (
                <li key={entry.key}>{row(entry)}</li>
              ))}
            </ul>
          </section>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/**
 * «صحبة» lives in the app (owner round 8, Q2: app only, an honest dialog and store links). What it is today (rounds,
 * short encouraging messages, by personal invitation), where to get the app (a button per store that has an address:
 * `lib/app-stores.ts`; none yet, so one plain line instead of a dead button) and a close button.
 */
function AppOnlyNote({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const tNav = useTranslations('nav');
  const t = useTranslations('circlesApp');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pe-8">
          <DialogTitle className="leading-8">{tNav('menuItems.circles')}</DialogTitle>
          <DialogDescription className="leading-7">{t('lead')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm leading-7">
          <p>{t('what')}</p>
          <p>{t('get')}</p>
        </div>
        <AppStoreLinks />
        <DialogClose asChild>
          <Button variant="outline" size="lg" className="min-h-11 w-full">
            {t('close')}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
