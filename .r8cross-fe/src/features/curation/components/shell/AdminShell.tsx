'use client';

import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Direction } from 'radix-ui';
import { Search } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Link, usePathname } from '@/i18n/navigation';
import { AdminCommand } from './AdminCommand';
import { AdminSidebar } from './AdminSidebar';
import { ADMIN_NAV_ITEMS, isActiveHref } from './admin-nav';

/** The desk: start-side rail + a sticky top bar (crumbs, ⌘K, theme) + the page. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin.shell');
  const tTheme = useTranslations('theme');
  const tNav = useTranslations('nav');
  const [commandOpen, setCommandOpen] = useState(false);
  const dir = useLocale() === 'ar' ? 'rtl' : 'ltr';

  // Radix primitives (tabs, toggle groups, menus, selects) default to LTR without a provider.
  return (
    <Direction.Provider dir={dir}>
      <SidebarProvider>
        <a
          href="#desk-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
        >
          {tNav('skipToContent')}
        </a>
        <AdminSidebar />
        <SidebarInset id="desk-content" className="min-w-0">
          <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
            <SidebarTrigger aria-label={t('toggleSidebar')} className="-ms-1" />
            <Separator orientation="vertical" className="hidden h-4 md:block" />
            <div className="hidden min-w-0 md:block">
              <DeskCrumbs />
            </div>
            <div className="ms-auto flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="desk-press justify-between text-muted-foreground md:w-56"
                aria-label={t('search')}
                onClick={() => setCommandOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <Search aria-hidden />
                  <span className="hidden md:inline">{t('search')}</span>
                </span>
                <KbdGroup dir="ltr" className="hidden md:inline-flex">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </KbdGroup>
              </Button>
              <ThemeToggle
                labels={{
                  toggle: tTheme('toggle'),
                  light: tTheme('light'),
                  dark: tTheme('dark'),
                  system: tTheme('system'),
                }}
              />
            </div>
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-6 px-6 pt-6 pb-10">{children}</div>
        </SidebarInset>
        <AdminCommand open={commandOpen} onOpenChange={setCommandOpen} />
      </SidebarProvider>
    </Direction.Provider>
  );
}

function DeskCrumbs() {
  const t = useTranslations('admin.shell');
  const pathname = usePathname();
  const section = ADMIN_NAV_ITEMS.filter((item) => item.href !== '/admin').find((item) =>
    isActiveHref(pathname, item.href),
  );
  const trail: { label: string; href?: string }[] = [{ label: t('groupReview'), href: '/admin' }];
  if (section) trail.push({ label: t(section.key), href: section.href });
  if (section?.key === 'quotes' && pathname !== section.href) {
    trail.push({ label: pathname.endsWith('/new') ? t('newQuote') : t('quote') });
  }
  if (!section) trail.push({ label: t('overview') });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={crumb.label}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {last || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
