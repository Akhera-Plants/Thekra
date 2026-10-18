/**
 * AuthNavItems — client component rendered in SiteHeader.
 * Shows login/register links for guests; user avatar + logout for signed-in users.
 * Keeps SiteHeader itself a Server Component.
 */
'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/shared/kit/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/features/auth/hooks/useSession';
import { Link, useRouter } from '@/i18n/navigation';

function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  return email[0].toUpperCase();
}

function GuestAuthLinks({
  signIn,
  register,
}: {
  signIn: string;
  register: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Button
        asChild
        variant="ghost"
        tone="neutral"
        size="sm"
        className="h-10 min-h-10 px-3 text-[15px] md:h-10 md:min-h-10"
      >
        <Link href="/login">{signIn}</Link>
      </Button>
      <Button
        asChild
        variant="solid"
        tone="primary"
        size="sm"
        className="h-10 min-h-10 px-3.5 text-[15px] md:h-10 md:min-h-10"
      >
        <Link href="/register">{register}</Link>
      </Button>
    </div>
  );
}

export function AuthNavItems() {
  const t = useTranslations('auth');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const { user, isAuthenticated, isLoading, clearSession } = useSession();
  // Match SSR: guest chrome until after mount (session restore is client-only).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted || isLoading || !isAuthenticated) {
    return <GuestAuthLinks signIn={t('signIn')} register={t('register')} />;
  }

  async function handleLogout() {
    await clearSession();
    toast.success(t('logoutSuccess'));
    router.push('/');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('userMenu')}
          className="rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {initials(user?.name ?? null, user?.email ?? '')}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {user?.email && (
          <div className="px-2 py-1.5">
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/favorites">{tNav('favorites')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">{tNav('settings')}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
