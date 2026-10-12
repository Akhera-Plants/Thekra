'use client';

/**
 * AdminSideNav — vertical navigation for admin routes.
 * Marks the active route. RTL-aware (logical margin/padding).
 */

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  Link2,
  AlertTriangle,
  Heart,
  Database,
  Tag,
  RefreshCcw,
  Flag,
} from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/admin/quotes', labelKey: 'nav.quotes', icon: BookOpen },
  { href: '/admin/linking', labelKey: 'nav.linking', icon: Link2 },
  { href: '/admin/sins', labelKey: 'nav.sins', icon: AlertTriangle },
  { href: '/admin/good-deeds', labelKey: 'nav.goodDeeds', icon: Heart },
  { href: '/admin/sources', labelKey: 'nav.sources', icon: Database },
  { href: '/admin/tags', labelKey: 'nav.tags', icon: Tag },
  { href: '/admin/sync', labelKey: 'nav.sync', icon: RefreshCcw },
  { href: '/admin/flags', labelKey: 'nav.flags', icon: Flag },
];

export function AdminSideNav() {
  const t = useTranslations('admin');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('nav.ariaLabel')}
      className="flex w-56 shrink-0 flex-col gap-1 border-e border-border bg-muted/30 p-3"
    >
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('nav.heading')}
      </p>
      <ul className="flex flex-col gap-1" role="list">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const isActive =
            href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-[opacity,background-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                  isActive
                    ? 'bg-background font-medium text-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{t(labelKey as Parameters<typeof t>[0])}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
