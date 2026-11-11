/**
 * Next.js route handler — auth session management.
 *
 * POST  /api/auth/session  — login (email+password → access token in JSON,
 *                            refresh token in httpOnly cookie)
 * DELETE /api/auth/session — logout (clears the cookie, calls backend logout)
 *
 * The access token is returned in the JSON response body so the client can
 * store it in memory only (never localStorage).
 * The refresh token is set as an httpOnly, Secure, SameSite=Lax cookie so
 * it is never readable by JavaScript.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
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

// ── POST /api/auth/session (login) ─────────────────────────────────────────

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  // Validate shape (never log the password)
  const { email, password } = body as { email?: string; password?: string };
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'email and password are required' },
      { status: 400 },
    );
  }

  // Forward to backend
  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
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
      { error: data.error ?? { message: 'Login failed' } },
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
  cookieStore.set({
    ...refreshCookieOptions(isSecure),
    value: refreshToken,
  });

  const mappedUser = mapAuthUser(user);
  if (!mappedUser) {
    return NextResponse.json(
      { error: { message: 'Unexpected user payload from backend' } },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { data: { accessToken, user: mappedUser } },
    { status: 200 },
  );
}

// ── DELETE /api/auth/session (logout) ──────────────────────────────────────

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const rt = cookieStore.get(COOKIE_NAME)?.value;

  // Best-effort: tell the backend to revoke the refresh token
  if (rt) {
    // We need the access token from the Authorization header
    const authorization = request.headers.get('Authorization') ?? '';
    try {
      await fetch(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
      });
    } catch {
      // ignore — we clear the cookie regardless
    }
  }

  // Always Secure in production, even if a proxy hands us an http:// URL.
  const isSecure = process.env.NODE_ENV === 'production' || request.url.startsWith('https');
  const cookieStore2 = await cookies();
  cookieStore2.set({
    ...refreshCookieOptions(isSecure),
    value: '',
    maxAge: 0,
  });

  return NextResponse.json({ data: null }, { status: 200 });
}
