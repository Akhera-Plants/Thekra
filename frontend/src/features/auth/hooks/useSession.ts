/**
 * useSession — the single source of truth for auth state on the client.
 *
 * Strategy:
 * 1. On mount, attempt a token refresh (GET /api/auth/refresh) to restore
 *    the session from the httpOnly cookie. This is the "persistent login"
 *    flow: the user stays logged in across page reloads without a cookie
 *    readable by JavaScript.
 * 2. After a successful login/register (called from useLogin/useRegister),
 *    the caller sets the access token + user via `setSession`.
 * 3. On logout, `clearSession` first pushes what is still unsynced (and, when something would be lost, warns once and
 *    stops: the second try within a minute signs out anyway), removes this browser's push reminders (best effort,
 *    while the token is still valid), wipes the in-memory token, calls DELETE /api/auth/session to clear the httpOnly
 *    cookie and removes the practice data of this account from the device (`wipeAllLocalPractice`): the next account
 *    never sees or uploads it.
 *
 * The `user` value is derived from the server response; the access token
 * lives in the api-client module (setAccessToken), never in React state.
 */
'use client';

import { fetchRouteJson } from '@/lib/api/route-fetch';
import { reportFailure } from '@/lib/errors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { setAccessToken } from '@/lib/api-client';
import { removePushOnSignOut } from '@/lib/push/web-push';
import { hasSignOutRisk, signOutRisk } from '@thekra/practice-core';
import { getPracticeSnapshot } from '@/lib/practice/local-store';
import { wipeAllLocalPractice } from '@/lib/practice/local-wipe';
import { flushPracticeSync, resumePracticeSync } from '@/lib/practice/sync-controller';
import {
  getVaultSaveState,
  getVaultSession,
  lastSealedFingerprint,
  programsFingerprint,
  setVaultSession,
} from '@/lib/practice/vault-flow';
import type { UserDto } from '@/lib/api/auth';
import { queryKeys } from '@/lib/query-keys';

interface SessionData {
  user: UserDto;
  accessToken: string;
}

/** Attempt to restore a session via the httpOnly refresh cookie. */
async function fetchSession(): Promise<SessionData | null> {
  let result: Awaited<ReturnType<typeof fetchRouteJson<{ data?: { accessToken?: string; user?: UserDto } }>>>;
  try {
    result = await fetchRouteJson('/api/auth/refresh', { method: 'POST' });
  } catch (error) {
    // Offline or the app is unreachable: stay signed out rather than fail the whole page.
    reportFailure('session restore', error);
    return null;
  }
  if (!result.ok) return null;
  const { accessToken, user } = result.json?.data ?? {};
  if (!accessToken || !user) return null;
  // Prime the in-memory token immediately
  setAccessToken(accessToken);
  return { accessToken, user };
}

export interface UseSessionReturn {
  user: UserDto | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setSession: (data: SessionData) => void;
  /**
   * 'unsynced': nothing was done, because this device holds data that did not reach the account (the caller shows the
   * warning); the next call within a minute signs out regardless. `discard` skips the push and the warning (the account
   * was deleted).
   */
  clearSession: (options?: { discard?: boolean }) => Promise<SignOutResult>;
}

export type SignOutResult = 'done' | 'unsynced';

/** When the unsynced warning was last shown: a second sign-out within this window goes ahead. */
let warnedAt = 0;
const WARN_WINDOW_MS = 60_000;

export function useSession(): UseSessionReturn {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SessionData | null>({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    staleTime: Infinity,   // session data does not go stale on its own
    gcTime: Infinity,
    retry: false,          // a failed refresh = guest; don't loop
    refetchOnWindowFocus: false,
    refetchOnMount: false, // already attempted once on first render
  });

  const setSession = useCallback(
    (sessionData: SessionData) => {
      setAccessToken(sessionData.accessToken);
      queryClient.setQueryData(queryKeys.session, sessionData);
    },
    [queryClient],
  );

  const clearSession = useCallback(
    async (options: { discard?: boolean } = {}): Promise<SignOutResult> => {
      const account = queryClient.getQueryData<SessionData | null>(queryKeys.session)?.user.id ?? null;
      if (!options.discard) {
        // What did not reach the account yet is pushed now (while the token is valid); what cannot be pushed is warned
        // about once, because signing out removes it from this device.
        const unsynced = account ? await flushPracticeSync(account) : 0;
        const programs = getPracticeSnapshot().store.programs;
        const inVault =
          getVaultSession() !== null && getVaultSaveState() === 'idle' && lastSealedFingerprint() === programsFingerprint(programs);
        if (hasSignOutRisk(signOutRisk(unsynced, programs.length, inVault)) && Date.now() - warnedAt > WARN_WINDOW_MS) {
          warnedAt = Date.now();
          resumePracticeSync();
          return 'unsynced';
        }
      }
      warnedAt = 0;

      // Reminders belong to the account: stop them on this browser. Never throws, waits at most a few seconds.
      await removePushOnSignOut();

      // «تخفَّف» is wiped from the device with everything else below; the account keeps it, encrypted. Forget the key.
      setVaultSession(null);

      // Clear in-memory token
      setAccessToken(null);

      // Delete the httpOnly cookie via route handler
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {
        // ignore network errors on logout
      });

      // The practice data of this account leaves the device: habits, programs (sealed copy and its key), reviews,
      // messages to oneself, reminders. The next account starts clean and can never upload it.
      await wipeAllLocalPractice();

      // Wipe cached session + all per-user data
      queryClient.setQueryData(queryKeys.session, null);
      queryClient.removeQueries({ queryKey: queryKeys.favorites.all });
      queryClient.removeQueries({ queryKey: queryKeys.favorites.quoteIds });
      queryClient.removeQueries({ queryKey: queryKeys.push.browser });
      return 'done';
    },
    [queryClient],
  );

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: data != null && data.user != null,
    setSession,
    clearSession,
  };
}
