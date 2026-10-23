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
  type ApiErrorKind,
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

/** `GET /sins/x/quotes`: method and path only, so logs never carry the origin or query values. */
function describeEndpoint(method: string | undefined, url: string | undefined): string | undefined {
  if (!url) return undefined;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  return `${(method ?? 'get').toUpperCase()} ${path}`;
}

function axiosErrorKind(
  error: { code?: string; response?: unknown },
  status: number,
  body: ApiErrorBody | undefined,
): ApiErrorKind {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'timeout';
  if (!error.response) return 'network';
  return isValidationFailure(status, body?.details) ? 'validation' : 'http';
}

function isValidationFailure(status: number, details: unknown): boolean {
  return (status === 400 || status === 422) && Array.isArray(details) && details.length > 0;
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

      // A cancelled request (AbortSignal, e.g. a newer chip click) is not a failure.
      if (axios.isCancel(error)) {
        return Promise.reject(error);
      }

      return Promise.reject(
        new ApiError({
          code: apiError?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR'),
          message: apiError?.message ?? error.message,
          status,
          kind: axiosErrorKind(error, status, apiError),
          details: asValidationDetails(apiError?.details),
          requestId: apiError?.requestId,
          endpoint: describeEndpoint(config?.method, config?.url),
          cause: error,
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

/** A 2xx answer that is not `{ data, meta? }` (a CDN error page, a proxy) is a failure, not data. */
function unwrapEnvelope<T>(
  envelope: unknown,
  endpoint: string,
  status: number,
): { data: T; meta?: PageMeta } {
  if (typeof envelope !== 'object' || envelope === null || !('data' in envelope)) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'Response is not an API envelope',
      status,
      kind: 'parse',
      endpoint,
    });
  }
  const { data, meta } = envelope as ApiEnvelope<T>;
  return { data, meta };
}

/**
 * Options only the server path understands. Public content is the same for every
 * visitor, so server reads go through Next's data cache (native `fetch`, which
 * axios bypasses) and are shared across requests until `revalidate` seconds pass.
 */
export type ApiGetConfig = AxiosRequestConfig & {
  /** Seconds the server may reuse the answer. Defaults by path, see `serverRevalidateFor`. */
  revalidate?: number;
  /** Extra data-cache tags (a tag per top-level resource is always added). */
  tags?: string[];
};

const CATALOGUE_REVALIDATE_SECONDS = 3600;
const CONTENT_REVALIDATE_SECONDS = 300;
const SERVER_TIMEOUT_MS = 8000;
/**
 * `next build` prerenders many pages at once against a cold API, and a failed page fails the
 * whole deploy, so the build waits longer and retries. A visitor's request never retries (they are
 * waiting): it fails fast into error.tsx with a retry button.
 */
const isBuildPhase = () => process.env.NEXT_PHASE === 'phase-production-build';
const BUILD_TIMEOUT_MS = 30_000;
const BUILD_ATTEMPTS = 3;
/** Whole-catalogue reads that change on a publish, not per visitor or per hour. */
const CATALOGUE_PATHS = new Set(['/sins', '/good-deeds', '/branches', '/sources', '/topic-themes']);

export function serverRevalidateFor(path: string): number {
  return CATALOGUE_PATHS.has(path) ? CATALOGUE_REVALIDATE_SECONDS : CONTENT_REVALIDATE_SECONDS;
}

function buildServerUrl(path: string, params: Record<string, unknown> | undefined): URL {
  const url = new URL(`${env.NEXT_PUBLIC_API_URL}/v1${path}`);
  const all = { ...(params ?? {}) };
  // Same default the axios interceptor injects.
  if (all.lang === undefined) all.lang = activeLocale;
  for (const [key, value] of Object.entries(all)) {
    if (value === undefined || value === null) continue;
    // `type=A&type=B`, matching the axios serializer (`indexes: null`).
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, String(item));
    }
  }
  return url;
}

async function serverGet<T>(
  path: string,
  config: ApiGetConfig | undefined,
): Promise<{ data: T; meta?: PageMeta }> {
  const endpoint = `GET ${path}`;
  const url = buildServerUrl(path, config?.params as Record<string, unknown> | undefined);
  const root = path.split('/')[1] ?? '';
  const attempts = isBuildPhase() ? BUILD_ATTEMPTS : 1;
  let response: Response | null = null;
  for (let attempt = 1; response === null; attempt += 1) {
    try {
      const attempted = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: {
          revalidate: config?.revalidate ?? serverRevalidateFor(path),
          tags: ['api', `api:${root}`, ...(config?.tags ?? [])],
        },
        signal: AbortSignal.timeout(isBuildPhase() ? BUILD_TIMEOUT_MS : SERVER_TIMEOUT_MS),
      });
      if (attempted.status >= 500 && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      response = attempted;
    } catch (error) {
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      throw new ApiError({
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Request failed',
        status: 0,
        kind: timedOut ? 'timeout' : 'network',
        endpoint,
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: ApiErrorBody } | null;
    const apiError = body?.error;
    throw new ApiError({
      code: apiError?.code ?? 'HTTP_ERROR',
      message: apiError?.message ?? `HTTP ${response.status}`,
      status: response.status,
      kind: isValidationFailure(response.status, apiError?.details) ? 'validation' : 'http',
      details: asValidationDetails(apiError?.details),
      requestId: apiError?.requestId,
      endpoint,
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'Response is not JSON',
      status: response.status,
      kind: 'parse',
      endpoint,
      cause: error,
    });
  }
  return unwrapEnvelope<T>(json, endpoint, response.status);
}

export async function apiGet<T>(
  path: string,
  config?: ApiGetConfig,
  client?: AxiosInstance,
): Promise<{ data: T; meta?: PageMeta }> {
  if (!client && typeof window === 'undefined') {
    return serverGet<T>(path, config);
  }
  const axiosConfig: ApiGetConfig = { ...config };
  delete axiosConfig.revalidate;
  delete axiosConfig.tags;
  const response = await (client ?? apiClient).get<unknown>(path, axiosConfig);
  return unwrapEnvelope<T>(response.data, describeEndpoint('get', path) ?? `GET ${path}`, response.status);
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
