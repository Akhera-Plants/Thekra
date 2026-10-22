/**
 * Next.js route handler — registration.
 *
 * POST /api/auth/register
 *   Proxies { email, password, name? } → backend `displayName`, then sets the
 *   httpOnly refresh cookie (same mechanics as /api/auth/session).
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { mapAuthUser } from '@/lib/api/map-auth-user';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const COOKIE_NAME = 'refresh_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, password, name, displayName } = body as {
    email?: string;
    password?: string;
    name?: string;
    displayName?: string;
  };
  const resolvedDisplayName =
    typeof displayName === 'string' && displayName.trim()
      ? displayName.trim()
      : typeof name === 'string' && name.trim()
        ? name.trim()
        : undefined;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'email and password are required' },
      { status: 400 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_URL}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ...(resolvedDisplayName ? { displayName: resolvedDisplayName } : {}),
      }),
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach backend' },
      { status: 502 },
    );
  }

  const data = await backendRes.json() as {
    data?: { accessToken?: string; refreshToken?: string; user?: unknown };
    error?: { message?: string; code?: string };
  };

  if (!backendRes.ok) {
    return NextResponse.json(
      { error: data.error ?? { message: 'Registration failed' } },
      { status: backendRes.status },
    );
  }

  const { accessToken, refreshToken, user } = data.data ?? {};

  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { error: { message: 'Unexpected response from backend' } },
      { status: 502 },
    );
  }

  // Always Secure in production, even if a proxy hands us an http:// URL.
  const isSecure = process.env.NODE_ENV === 'production' || request.url.startsWith('https');
  const cookieStore = await cookies();
  cookieStore.set({ ...refreshCookieOptions(isSecure), value: refreshToken });

  const mappedUser = mapAuthUser(user);
  if (!mappedUser) {
    return NextResponse.json(
      { error: { message: 'Unexpected user payload from backend' } },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { data: { accessToken, user: mappedUser } },
    { status: 201 },
  );
}
