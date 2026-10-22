'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useSession } from '@/features/auth/hooks/useSession';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useFlagCount } from '../../hooks/useAdminReview';
import { formatCount } from '../kit/format';
import { ADMIN_NAV, isActiveHref } from './admin-nav';

/**
 * Start-side rail of the desk (right in RTL). Same paper as the canvas, a hairline edge.
 * Bottom: the owner's intention, verbatim from messages `app.intentionReminder`.
 */
export function AdminSidebar() {
  const t = useTranslations('admin.shell');
  const tApp = useTranslations('app');
  const locale = useLocale();
  const pathname = usePathname();
  const highOpen = useFlagCount({ status: 'OPEN', severity: 'HIGH' });

  return (
    <Sidebar side={locale === 'ar' ? 'right' : 'left'} collapsible="offcanvas">
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border px-4">
        <Link
          href="/admin"
          className="flex items-baseline gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="font-arabic-display text-lg font-semibold">{t('wordmark')}</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <nav aria-label={t('navLabel')}>
          {ADMIN_NAV.map((group) => (
            <SidebarGroup key={group.key} className="py-1.5">
              <SidebarGroupLabel>{t(group.key)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isActiveHref(pathname, item.href);
                    const showHigh = item.key === 'flags' && (highOpen.data ?? 0) > 0;
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link href={item.href} aria-current={active ? 'page' : undefined}>
                            <item.icon aria-hidden />
                            <span>{t(item.key)}</span>
                          </Link>
                        </SidebarMenuButton>
                        {showHigh ? (
                          <SidebarMenuBadge
                            className="text-destructive"
                            aria-label={t('highOpen', { count: highOpen.data ?? 0 })}
                          >
                            {formatCount(highOpen.data ?? 0)}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="sm" className="text-muted-foreground">
              <Link href="/">
                <ExternalLink aria-hidden />
                <span>{t('backToSite')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
        <p
          aria-label={t('intention')}
          className="px-2 font-arabic-text text-xs leading-relaxed text-pretty text-muted-foreground"
        >
          {tApp('intentionReminder')}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu() {
  const t = useTranslations('admin.shell');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const { user, clearSession } = useSession();
  const name = user?.name || user?.email || '';
  const initial = name.trim().charAt(0).toUpperCase() || '·';

  async function logout() {
    await clearSession();
    toast.success(tAuth('logoutSuccess'));
    router.push('/');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" aria-label={t('account')}>
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col text-start leading-tight">
            <span className="truncate text-sm font-medium">{user?.name ?? user?.email}</span>
            {user?.name ? (
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            ) : null}
          </span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => void logout()}>
            <LogOut aria-hidden />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
