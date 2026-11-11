'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { PracticeLoading } from '@/features/practice/components/PracticeLoading';
import { useSession } from '../hooks/useSession';

const noSubscribe = () => () => {};

/**
 * «ورد اليوم», «السجل» and every practice page are for signed-in members (owner, 2026-11-01). A guest is sent to
 * «تسجيل الدخول» and comes back to the same page after signing in or up (`?next=`). The session is restored on the
 * client (httpOnly cookie, `/api/auth/refresh`), so the loader shows until it is known.
 */
export function MembersOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useSession();
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const router = useRouter();
  const pathname = usePathname();
  const guest = mounted && !isLoading && !isAuthenticated;

  useEffect(() => {
    // The query comes along («ابدأ بها» on a good-deed page opens `/practice?add=1&habit=…`).
    if (guest) router.replace({ pathname: '/login', query: { next: `${pathname}${window.location.search}` } });
  }, [guest, router, pathname]);

  if (!mounted || isLoading || !isAuthenticated) return <PracticeLoading />;
  return children;
}
