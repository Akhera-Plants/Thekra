/**
 * FavoritesGuard — renders SignInPrompt for guests, children for authenticated users.
 * No redirect ever — guest flows are always accessible (frontend-plan §2).
 */
'use client';

import type { ReactNode } from 'react';
import { useSession } from '@/features/auth/hooks/useSession';
import { SignInPrompt } from './SignInPrompt';

interface FavoritesGuardProps {
  children: ReactNode;
}

export function FavoritesGuard({ children }: FavoritesGuardProps) {
  const { isAuthenticated, isLoading } = useSession();

  // While restoring session from the httpOnly cookie, show nothing (prevents flicker)
  if (isLoading) return null;

  if (!isAuthenticated) {
    return <SignInPrompt variant="page" />;
  }

  return <>{children}</>;
}
