'use client';

/**
 * AdminGuard — client-side guard that redirects non-admin users.
 *
 * Route-level protection: the backend already enforces ADMIN via JWT guard.
 * This guard provides client-side feedback (forbidden page, admin login entry)
 * so the UX is clean — it is not a security boundary.
 *
 * When public accounts chrome is hidden, /login redirects home — so unauthenticated
 * admins sign in here on /admin instead.
 */

import { useTranslations } from 'next-intl';
import { useSession } from '@/features/auth/hooks/useSession';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldOff } from 'lucide-react';
import { LoginForm } from '@/features/auth/components/LoginForm';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading } = useSession();
  const t = useTranslations('admin');
  const tAuth = useTranslations('auth');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-semibold">{tAuth('loginTitle')}</h1>
          <p className="text-sm text-muted-foreground">{tAuth('loginSubtitle')}</p>
        </div>
        <LoginForm redirectTo="/admin" />
      </div>
    );
  }

  if (user.role !== 'ADMIN' && user.role !== 'REVIEWER') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <ShieldOff className="h-12 w-12 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-semibold">{t('forbidden.title')}</h1>
        <p className="text-muted-foreground">{t('forbidden.description')}</p>
      </div>
    );
  }

  return <>{children}</>;
}
