/**
 * Next.js route handler — registration.
 *
 * POST /api/auth/register
 *   Proxies { email, password, name? } to the backend, then sets the
 *   httpOnly refresh cookie (same mechanics as /api/auth/session).
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

  const { email, password, name } = body as {
    email?: string;
    password?: string;
    name?: string;
  };

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
      body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
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

  const isSecure = request.url.startsWith('https');
  const cookieStore = await cookies();
  cookieStore.set({ ...refreshCookieOptions(isSecure), value: refreshToken });

  return NextResponse.json({ data: { accessToken, user } }, { status: 201 });
}
