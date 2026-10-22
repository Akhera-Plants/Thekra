import { apiPost } from '../api-client';
import type { AuthTokensDto, LoginDto, RegisterDto, UserDto } from '../types/api';
import { apiGet } from '../api-client';

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function loginUser(dto: LoginDto): Promise<AuthTokensDto> {
  const res = await apiPost<AuthTokensDto>('/auth/login', dto, {
    // skipLang: don't append ?lang to auth calls
    // @ts-expect-error — skipLang is a custom flag read by the interceptor
    skipLang: true,
  });
  return res.data;
}

export async function registerUser(dto: RegisterDto): Promise<AuthTokensDto> {
  const res = await apiPost<AuthTokensDto>('/auth/register', dto, {
    // @ts-expect-error — skipLang is a custom flag read by the interceptor
    skipLang: true,
  });
  return res.data;
}

export async function fetchMe(): Promise<UserDto> {
  const res = await apiGet<UserDto>('/auth/me', {
    // @ts-expect-error — skipLang is a custom flag read by the interceptor
    skipLang: true,
  });
  return res.data;
}

export async function logoutUser(): Promise<void> {
  try {
    await apiPost('/auth/logout', undefined, {
      // @ts-expect-error — skipLang is a custom flag read by the interceptor
      skipLang: true,
    });
  } catch {
    // Ignore logout errors — clear local state regardless
  }
}
