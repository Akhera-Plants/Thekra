'use client';

/**
 * AdminGuard — client-side guard that redirects non-admin users.
 *
 * Route-level protection: the backend already enforces ADMIN via JWT guard.
 * This guard provides client-side feedback (forbidden page, redirect to login)
 * so the UX is clean — it is not a security boundary.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useSession } from '@/features/auth/hooks/useSession';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldOff } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const t = useTranslations('admin');

  useEffect(() => {
    if (!isLoading && user === null) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

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
    return null;
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
