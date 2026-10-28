/**
 * Axios client for the Thekra API.
 * Mirrors the shape of frontend/src/lib/api-client.ts for cross-client convention parity.
 *
 * Key differences from the web client:
 *  - No httpOnly cookie for refresh (mobile doesn't have a cookie jar)
 *  - Refresh token is read from expo-secure-store and sent in the request body
 *  - No Next.js /api/auth/refresh route handler — calls /v1/auth/refresh directly
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ApiError, type ApiEnvelope, type ApiErrorBody, type ApiValidationDetail, type PageMeta } from './types/api';
import type { LocaleCode } from './types/enums';

// ── Config ────────────────────────────────────────────────────────────────────

const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env['EXPO_PUBLIC_API_URL'] ??
  'http://localhost:3001';

/** Base URL of the API (no `/v1`), from `EXPO_PUBLIC_API_URL` via app.config.ts. */
export function getApiBaseUrl(): string {
  return API_URL.replace(/\/+$/, '');
}

export const SECURE_STORE_REFRESH_KEY = 'thekra_refresh_token';

// ── Locale ────────────────────────────────────────────────────────────────────

let activeLocale: LocaleCode = 'ar';

export function setApiLocale(locale: LocaleCode): void {
  activeLocale = locale;
}

export function getApiLocale(): LocaleCode {
  return activeLocale;
}

// ── In-memory access token (never persisted) ──────────────────────────────────

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ── Secure refresh token storage ──────────────────────────────────────────────

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_REFRESH_KEY, token);
}

export async function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_REFRESH_KEY);
}

export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_KEY);
}

// ── Single-flight 401 refresh ─────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a new access token.
 * Single-flight: concurrent 401s share the same promise.
 *
 * Backend requirement: POST /v1/auth/refresh must accept { refreshToken } in the
 * request body (additive change from the web's cookie-based flow).
 */
export async function performRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    try {
      const storedRefreshToken = await loadRefreshToken();
      if (!storedRefreshToken) {
        setAccessToken(null);
        return null;
      }

      const res = await axios.post<ApiEnvelope<{ accessToken: string; refreshToken?: string }>>(
        `${API_URL}/v1/auth/refresh`,
        { refreshToken: storedRefreshToken },
        { timeout: 10_000 },
      );

      const newAccessToken = res.data.data.accessToken;
      const newRefreshToken = res.data.data.refreshToken;

      setAccessToken(newAccessToken);
      if (newRefreshToken) {
        await saveRefreshToken(newRefreshToken);
      }

      return newAccessToken;
    } catch {
      setAccessToken(null);
      await clearRefreshToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Interceptors ──────────────────────────────────────────────────────────────

type EnvelopeAxiosConfig = InternalAxiosRequestConfig & {
  skipLang?: boolean;
  _retried?: boolean;
};

function asValidationDetails(value: unknown): ApiValidationDetail[] | null {
  if (!Array.isArray(value)) return null;
  return value as ApiValidationDetail[];
}

function attachInterceptors(client: AxiosInstance): void {
  // Request: inject lang + Bearer
  client.interceptors.request.use((config: EnvelopeAxiosConfig) => {
    if (!config.skipLang) {
      const params = (config.params as Record<string, unknown>) ?? {};
      if (params['lang'] === undefined) {
        config.params = { ...params, lang: activeLocale };
      }
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  });

  // Response: normalise errors + single-flight 401 refresh
  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error);
      }

      const status = error.response?.status ?? 0;
      const body = error.response?.data as { error?: ApiErrorBody } | undefined;
      const apiError = body?.error;
      const config = error.config as EnvelopeAxiosConfig | undefined;

      if (
        status === 401 &&
        apiError?.code === 'UNAUTHENTICATED' &&
        config &&
        !config._retried
      ) {
        config._retried = true;
        const newToken = await performRefresh();
        if (newToken && config.headers) {
          config.headers.Authorization = `Bearer ${newToken}`;
          return client.request(config);
        }
      }

      return Promise.reject(
        new ApiError({
          code: apiError?.code ?? 'NETWORK_ERROR',
          message: apiError?.message ?? error.message,
          status,
          details: asValidationDetails(apiError?.details),
          rawDetails: apiError?.details,
          requestId: apiError?.requestId,
        }),
      );
    },
  );
}

// ── Client factory ────────────────────────────────────────────────────────────

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${API_URL}/v1`,
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
  });
  attachInterceptors(client);
  return client;
}

export const apiClient = createClient();

// ── Convenience wrappers ──────────────────────────────────────────────────────

export async function apiGet<T>(
  path: string,
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<{ data: T; meta?: PageMeta }> {
  const response = await client.get<ApiEnvelope<T>>(path, config);
  const envelope = response.data;
  return { data: envelope.data, meta: envelope.meta };
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<{ data: T; meta?: PageMeta }> {
  const response = await client.post<ApiEnvelope<T>>(path, body, config);
  const envelope = response.data;
  return { data: envelope.data, meta: envelope.meta };
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<{ data: T; meta?: PageMeta }> {
  const response = await client.patch<ApiEnvelope<T>>(path, body, config);
  const envelope = response.data;
  return { data: envelope.data, meta: envelope.meta };
}

export async function apiDelete(
  path: string,
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<void> {
  await client.delete(path, config);
}
