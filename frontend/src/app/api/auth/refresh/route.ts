/**
 * Next.js route handler — token refresh.
 *
 * POST /api/auth/refresh
 *   Reads the httpOnly `refresh_token` cookie and exchanges it for a new
 *   access token via the backend. Returns { data: { accessToken, user } }.
 *   On success, rotates the refresh cookie with a new value from the backend.
 *
 * Called by the client-side single-flight 401 interceptor only.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { fetchAuthMeFromBackend } from '@/lib/api/fetch-auth-me';
import { mapAuthUser } from '@/lib/api/map-auth-user';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const COOKIE_NAME = 'refresh_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function refreshCookieOptions(secure: boolean) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No refresh token' } },
      { status: 401 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return NextResponse.json(
      { error: { message: 'Could not reach backend' } },
      { status: 502 },
    );
  }

  const data = await backendRes.json() as {
    data?: { accessToken?: string; refreshToken?: string; user?: unknown };
    error?: { message?: string; code?: string };
  };

  if (!backendRes.ok) {
    // Revoke the stale cookie
    const cs = await cookies();
    cs.set({ ...refreshCookieOptions(false), value: '', maxAge: 0 });

    return NextResponse.json(
      { error: data.error ?? { message: 'Refresh failed' } },
      { status: backendRes.status },
    );
  }

  const { accessToken, refreshToken: newRefreshToken, user: userFromRefresh } =
    data.data ?? {};

  if (!accessToken) {
    return NextResponse.json(
      { error: { message: 'Unexpected response from backend' } },
      { status: 502 },
    );
  }

  const isSecure = request.url.startsWith('https');

  // Rotate refresh cookie if backend issued a new one
  if (newRefreshToken) {
    const cs = await cookies();
    cs.set({ ...refreshCookieOptions(isSecure), value: newRefreshToken });
  }

  const meRaw =
    userFromRefresh ?? (await fetchAuthMeFromBackend(accessToken));
  const mappedUser = mapAuthUser(meRaw);
  if (!mappedUser) {
    return NextResponse.json(
      { error: { message: 'Could not load user after refresh' } },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { data: { accessToken, user: mappedUser } },
    { status: 200 },
  );
}
