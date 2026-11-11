/**
 * useRegister — mutation that calls POST /api/auth/register (Next.js route handler).
 */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setAccessToken } from '@/lib/api-client';
import { fetchRouteJson } from '@/lib/api/route-fetch';
import { ApiError } from '@/lib/types/api';
import type { UserDto } from '@/lib/api/auth';
import { queryKeys } from '@/lib/query-keys';

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

async function registerViaRouteHandler(input: RegisterInput): Promise<{
  accessToken: string;
  user: UserDto;
}> {
  const { ok, status, json } = await fetchRouteJson<{
    data?: { accessToken?: string; user?: UserDto };
    error?: { message?: string; code?: string };
  }>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!ok) {
    throw new ApiError({
      code: json?.error?.code ?? 'REGISTER_FAILED',
      message: json?.error?.message ?? 'Registration failed',
      status,
    });
  }

  const { accessToken, user } = json?.data ?? {};
  if (!accessToken || !user) {
    throw new ApiError({
      code: 'UNEXPECTED_RESPONSE',
      message: 'Unexpected response from register handler',
      status: 502,
    });
  }

  return { accessToken, user };
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerViaRouteHandler,
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      queryClient.setQueryData(queryKeys.session, data);
    },
  });
}
