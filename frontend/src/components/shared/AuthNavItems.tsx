/**
 * AuthNavItems — client component rendered in SiteHeader.
 * Shows login/register links for guests; user avatar + logout for signed-in users.
 * Keeps SiteHeader itself a Server Component.
 */
'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/features/auth/hooks/useSession';
import { Link, useRouter } from '@/i18n/navigation';
import { HEADER_ACCOUNT } from './header-menu';
import { ProfileMark } from './ProfileMark';

function GuestAuthLinks({
  signIn,
  register,
}: {
  signIn: string;
  register: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {/* «تسجيل الدخول» is the primary action (owner, 2026-11-01); «إنشاء حساب» the outlined one, same height and padding. */}
      <Link href="/register" className="outline-button auth-button auth-register">
        {register}
      </Link>
      <Link href="/login" className="solid-button auth-button auth-sign-in">
        {signIn}
      </Link>
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
    if ((await clearSession()) === 'unsynced') {
      toast.warning(t('logoutUnsynced'));
      return;
    }
    toast.success(t('logoutSuccess'));
    router.push('/');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('userMenu')}
          className="group inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ProfileMark className="group-hover:border-primary/40 group-hover:bg-primary/15 group-data-[state=open]:border-primary/40 group-data-[state=open]:bg-primary/15" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {user?.email && (
          <div className="flex items-center gap-2.5 px-2 py-2">
            <ProfileMark className="size-8" />
            <div className="min-w-0">
              {user.name ? <p className="truncate text-sm font-medium text-foreground">{user.name}</p> : null}
              <p className="truncate text-xs text-muted-foreground">
                <bdi>{user.email}</bdi>
              </p>
            </div>
          </div>
        )}
        <DropdownMenuSeparator />
        {/* The account menu (C-05 a): الحساب، الإعدادات، then تسجيل الخروج. The settings live only here. */}
        {HEADER_ACCOUNT.map((entry) => (
          <DropdownMenuItem key={entry.key} asChild className="min-h-11">
            <Link href={entry.href ?? '/settings'}>{tNav(`menuItems.${entry.key}`)}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="min-h-11 text-destructive focus:text-destructive"
        >
          {tNav('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
