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
 * 3. On logout, `clearSession` wipes the in-memory token and calls
 *    DELETE /api/auth/session to clear the httpOnly cookie.
 *
 * The `user` value is derived from the server response; the access token
 * lives in the api-client module (setAccessToken), never in React state.
 */
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { setAccessToken } from '@/lib/api-client';
import type { UserDto } from '@/lib/api/auth';
import { queryKeys } from '@/lib/query-keys';

interface SessionData {
  user: UserDto;
  accessToken: string;
}

/** Attempt to restore a session via the httpOnly refresh cookie. */
async function fetchSession(): Promise<SessionData | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!res.ok) return null;
  const json = await res.json() as {
    data?: { accessToken?: string; user?: UserDto };
  };
  const { accessToken, user } = json.data ?? {};
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
  clearSession: () => Promise<void>;
}

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

  const clearSession = useCallback(async () => {
    // Clear in-memory token first
    setAccessToken(null);

    // Delete the httpOnly cookie via route handler
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {
      // ignore network errors on logout
    });

    // Wipe cached session + all per-user data
    queryClient.setQueryData(queryKeys.session, null);
    queryClient.removeQueries({ queryKey: queryKeys.favorites.all });
    queryClient.removeQueries({ queryKey: queryKeys.favorites.quoteIds });
  }, [queryClient]);

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: data != null && data.user != null,
    setSession,
    clearSession,
  };
}
