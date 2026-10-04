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

/** In-memory access token slot (phase 4 fills this; never localStorage). */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

type EnvelopeAxiosConfig = InternalAxiosRequestConfig & {
  skipLang?: boolean;
};

function attachInterceptors(client: AxiosInstance): void {
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

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error);
      }

      const status = error.response?.status ?? 0;
      const body = error.response?.data as { error?: ApiErrorBody } | undefined;
      const apiError = body?.error;

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
