/**
 * AuthNavItems — client component rendered in SiteHeader.
 * Shows login/register links for guests; user avatar + logout for signed-in users.
 * Keeps SiteHeader itself a Server Component.
 */
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSession } from '@/features/auth/hooks/useSession';

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

export function AuthNavItems() {
  const t = useTranslations('auth');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const { user, isAuthenticated, isLoading, clearSession } = useSession();

  // During session restore, render nothing to avoid flash
  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t('signIn')}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">{t('register')}</Link>
        </Button>
      </div>
    );
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
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
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
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
