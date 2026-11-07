/**
 * FavoritesGuard — renders SignInPrompt for guests, children for authenticated users.
 * No redirect ever — guest flows are always accessible (frontend-plan §2).
 */
'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { useSession } from '@/features/auth/hooks/useSession';
import { SignInPrompt } from './SignInPrompt';

interface FavoritesGuardProps {
  children: ReactNode;
}

const noSubscribe = () => () => {};

export function FavoritesGuard({ children }: FavoritesGuardProps) {
  const { isAuthenticated, isLoading } = useSession();
  // Same as the server render until mounted: the session can resolve before this part hydrates (React error 418).
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);

  // While restoring session from the httpOnly cookie, show nothing (prevents flicker)
  if (!mounted || isLoading) return null;

  if (!isAuthenticated) {
    return <SignInPrompt variant="page" />;
  }

  return <>{children}</>;
}
