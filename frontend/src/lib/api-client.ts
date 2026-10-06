import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/lib/env';
import {
  ApiError,
  type ApiEnvelope,
  type ApiErrorBody,
  type ApiValidationDetail,
  type PageMeta,
} from '@/lib/types/api';
import type { LocaleCode } from '@/lib/types/enums';

function asValidationDetails(value: unknown): ApiValidationDetail[] | null {
  if (!Array.isArray(value)) return null;
  return value as ApiValidationDetail[];
}

/** Active UI locale for `?lang=` injection. Updated by i18n once wired (step 4). */
let activeLocale: LocaleCode = 'ar';

export function setApiLocale(locale: LocaleCode): void {
  activeLocale = locale;
}

export function getApiLocale(): LocaleCode {
  return activeLocale;
}

/** In-memory access token slot (phase 4). Never stored in localStorage. */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ── Single-flight 401 refresh ─────────────────────────────────────────────
/** In-flight refresh promise — null when not refreshing. */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange the httpOnly refresh cookie (via Next.js route handler) for a new
 * access token. Single-flight: concurrent 401s share the same promise.
 * Returns the new access token or null on failure.
 */
async function performRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const json = await res.json() as {
        data?: { accessToken?: string };
      };
      const newToken = json.data?.accessToken ?? null;
      setAccessToken(newToken);
      return newToken;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

type EnvelopeAxiosConfig = InternalAxiosRequestConfig & {
  skipLang?: boolean;
  _retried?: boolean;
};

function attachInterceptors(client: AxiosInstance): void {
  // ── Request: inject lang + Bearer ────────────────────────────────────────
  client.interceptors.request.use((config: EnvelopeAxiosConfig) => {
    if (!config.skipLang) {
      const params = config.params ?? {};
      if (params.lang === undefined) {
        config.params = { ...params, lang: activeLocale };
      }
    }

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  });

  // ── Response: normalise errors + single-flight 401 refresh ───────────────
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

      // Attempt a single token refresh on 401 UNAUTHENTICATED (not 403 FORBIDDEN)
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
          requestId: apiError?.requestId,
        }),
      );
    },
  );
}

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${env.NEXT_PUBLIC_API_URL}/v1`,
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
    // Nest `TransformToArray` expects `type=A&type=B`, not `type[]=A`.
    paramsSerializer: { indexes: null },
  });
  attachInterceptors(client);
  return client;
}

export const apiClient = createClient();

/** RSC-friendly client (same interceptors; cookies/headers can be forwarded later). */
export function createServerApiClient(): AxiosInstance {
  return createClient();
}

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
