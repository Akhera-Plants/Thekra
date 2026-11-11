/**
 * useLogin — mutation that calls POST /api/auth/session (Next.js route handler).
 * On success, wires the returned access token into the in-memory slot and
 * updates the session query cache.
 */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setAccessToken } from '@/lib/api-client';
import { fetchRouteJson } from '@/lib/api/route-fetch';
import { ApiError } from '@/lib/types/api';
import type { UserDto } from '@/lib/api/auth';
import { queryKeys } from '@/lib/query-keys';

export interface LoginInput {
  email: string;
  password: string;
}

async function loginViaRouteHandler(input: LoginInput): Promise<{
  accessToken: string;
  user: UserDto;
}> {
  const { ok, status, json } = await fetchRouteJson<{
    data?: { accessToken?: string; user?: UserDto };
    error?: { message?: string; code?: string };
  }>('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!ok) {
    throw new ApiError({
      code: json?.error?.code ?? 'LOGIN_FAILED',
      message: json?.error?.message ?? 'Login failed',
      status,
    });
  }

  const { accessToken, user } = json?.data ?? {};
  if (!accessToken || !user) {
    throw new ApiError({
      code: 'UNEXPECTED_RESPONSE',
      message: 'Unexpected response from login handler',
      status: 502,
    });
  }

  return { accessToken, user };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginViaRouteHandler,
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      queryClient.setQueryData(queryKeys.session, data);
    },
  });
}
