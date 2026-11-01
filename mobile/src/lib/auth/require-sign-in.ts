/**
 * «ورد اليوم», «السجل» and every practice screen are for signed-in members (owner, 2026-11-01, same as the website):
 * a guest is sent to sign in and lands on the screen they asked for once signed in or up (`next`).
 */
import { useEffect } from 'react';
import { router, type Href } from 'expo-router';
import { useAuthStore } from '../stores/auth-store';

export const isSignedIn = () => useAuthStore.getState().user !== null;

/** Opens «تسجيل الدخول» on top, remembering where to go after it. */
export function openSignIn(next: string) {
  router.push({ pathname: '/(auth)/login', params: { next } });
}

/** After signing in or up: the screen the guest asked for, else back to where they were. */
export function leaveAuth(next: string | undefined) {
  if (next && next.startsWith('/')) router.replace(next as Href);
  else router.back();
}

/** For a members-only screen reached directly (a link, a notification): a guest is sent to sign in instead. */
export function useRequireSignIn(next: string, required = true): boolean {
  const signedIn = useAuthStore((s) => s.user !== null);
  const loading = useAuthStore((s) => s.isLoading);
  useEffect(() => {
    if (required && !loading && !signedIn) router.replace({ pathname: '/(auth)/login', params: { next } });
  }, [required, loading, signedIn, next]);
  return signedIn || !required;
}
