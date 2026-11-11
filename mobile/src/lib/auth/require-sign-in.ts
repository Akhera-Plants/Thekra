/**
 * «ورد اليوم», «السجل» and every practice screen are for signed-in members (owner, 2026-11-01, same as the website):
 * a guest is sent to sign in and lands on the screen they asked for once signed in or up (`next`).
 */
import { useEffect } from 'react';
import { router, type Href } from 'expo-router';
import { confirm } from '@/ui/ConfirmDialog';
import i18n from '../i18n';
import { useAuthStore } from '../stores/auth-store';

export const isSignedIn = () => useAuthStore.getState().user !== null;

/** Why the sign-in screen was opened: it says it in one line (owner round 8, item 1). */
export type SignInWhy = 'bookmark' | 'habits' | 'moment' | 'sin' | 'reminders';

/** The reason a members-only path needs an account, read from where the person was headed. */
export function whyFromNext(next: string | undefined): SignInWhy | undefined {
  if (!next) return undefined;
  if (next.startsWith('/practice/moment')) return 'moment';
  if (next.startsWith('/practice/sin-program')) return 'sin';
  if (next.startsWith('/settings/notifications')) return 'reminders';
  if (next.startsWith('/habits') || next.startsWith('/practice')) return 'habits';
  return undefined;
}

/** Opens «تسجيل الدخول» on top, remembering where to go after it (and why it was needed). */
export function openSignIn(next?: string, why?: SignInWhy) {
  const reason = why ?? whyFromNext(next);
  const params: Record<string, string> = {};
  if (next) params.next = next;
  if (reason) params.why = reason;
  router.push({ pathname: '/(auth)/login', params });
}

/**
 * A guest tapped something that needs an account (the bookmark on a card): our dialog says why, with «سجّل الدخول» and
 * «لاحقًا». Never a silent failure. `next` brings the person back to what they wanted; without it, back to the page.
 */
export async function askSignIn(why: SignInWhy, next?: string): Promise<void> {
  const ok = await confirm({
    title: i18n.t(`auth.prompt.${why}.title`),
    message: i18n.t(`auth.prompt.${why}.message`),
    confirmLabel: i18n.t('auth.signInNow'),
    cancelLabel: i18n.t('auth.later'),
    icon: null,
  });
  if (ok) openSignIn(next, why);
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
    if (!required || loading || signedIn) return;
    const why = whyFromNext(next);
    router.replace({ pathname: '/(auth)/login', params: why ? { next, why } : { next } });
  }, [required, loading, signedIn, next]);
  return signedIn || !required;
}
