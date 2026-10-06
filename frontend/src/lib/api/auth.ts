/**
 * Auth API helpers — backend endpoints: POST /auth/register, /auth/login,
 * /auth/refresh, /auth/logout, GET /auth/me
 *
 * NOTE: login/register/refresh are called via Next.js route handlers so the
 * refresh token lands in an httpOnly cookie. Direct backend calls here are
 * used only for /auth/logout and /auth/me.
 */

import { apiGet, apiPost } from '@/lib/api-client';
import { mapAuthUser } from '@/lib/api/map-auth-user';

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  user: UserDto;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  email: string;
  password: string;
  /** Sent to backend as `displayName`. */
  name?: string;
}

/** GET /auth/me — requires Bearer token already set on apiClient */
export async function getMe(): Promise<UserDto> {
  const { data } = await apiGet<unknown>('/auth/me');
  const user = mapAuthUser(data);
  if (!user) {
    throw new Error('Unexpected /auth/me response');
  }
  return user;
}

/**
 * POST /auth/logout — tells the backend to revoke the refresh token.
 * The caller (Next route handler) also clears the httpOnly cookie.
 */
export async function logoutFromBackend(): Promise<void> {
  await apiPost('/auth/logout');
}
