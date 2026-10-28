/**
 * Optional account sign-in (email + password) against the Thekra API, and an authenticated request helper that
 * refreshes the access token when it is about to expire or when the API answers 401.
 *
 * API (backend/src/modules/auth/auth.controller.ts), all wrapped in `{ data }`:
 *   - POST /v1/auth/login   { email, password }  → { user: { id, email, … }, accessToken, refreshToken, expiresIn }
 *   - POST /v1/auth/refresh { refreshToken }     → { accessToken, refreshToken, expiresIn } (rotated pair)
 *   - POST /v1/auth/logout  (Bearer)             → 204; stateless, the client drops its tokens
 * Errors are `{ error: { code, message } }`.
 *
 * Tokens live in `chrome.storage.local` only. The password is never stored. Pure apart from the injected
 * `fetch` and token store, so it is tested in Node.
 */
import { API_ORIGIN } from './cache.js';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  /** The account's email, shown in the popup. */
  email: string;
}

export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens | null): Promise<void>;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type HttpFetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<HttpResponse>;

/** Why an account call failed, for the popup's wording. */
export type AuthErrorCode = 'invalid' | 'throttled' | 'offline' | 'expired' | 'signedOut' | 'server';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly status = 0,
  ) {
    super(`auth: ${code}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'AuthError';
  }
}

/** Refresh this long before the access token expires. */
export const REFRESH_MARGIN_MS = 60_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Tokens from untrusted storage, or `null`. */
export function parseTokens(raw: unknown): Tokens | null {
  if (!isRecord(raw)) return null;
  const { accessToken, refreshToken, expiresAt, email } = raw;
  if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken) return null;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;
  return { accessToken, refreshToken, expiresAt, email: typeof email === 'string' ? email : '' };
}

function tokensFrom(body: unknown, email: string, now: number): Tokens | null {
  const data = isRecord(body) && isRecord(body.data) ? body.data : null;
  if (!data) return null;
  const expiresIn = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : 900;
  const user = isRecord(data.user) ? data.user : {};
  return parseTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: now + expiresIn * 1000,
    email: typeof user.email === 'string' ? user.email : email,
  });
}

function statusError(status: number): AuthError {
  if (status === 401 || status === 400) return new AuthError('invalid', status);
  if (status === 429) return new AuthError('throttled', status);
  return new AuthError('server', status);
}

export interface AuthClientDeps {
  fetch: HttpFetch;
  tokens: TokenStore;
  now?: () => number;
  origin?: string;
}

export interface ApiResult {
  status: number;
  ok: boolean;
  body: unknown;
}

export interface AuthClient {
  signIn(email: string, password: string): Promise<Tokens>;
  /** Drops the tokens (and tells the API, best effort). Local practice data is kept. */
  signOut(): Promise<void>;
  /** An authenticated JSON request. Throws AuthError('signedOut'|'expired'|'offline'). */
  request(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult>;
}

export function createAuthClient(deps: AuthClientDeps): AuthClient {
  const now = deps.now ?? Date.now;
  const origin = deps.origin ?? API_ORIGIN;
  const json = { accept: 'application/json', 'content-type': 'application/json' };
  let refreshing: Promise<Tokens> | null = null;

  async function send(path: string, method: string, headers: Record<string, string>, body?: unknown): Promise<HttpResponse> {
    try {
      return await deps.fetch(`${origin}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch {
      throw new AuthError('offline');
    }
  }

  async function readJson(res: HttpResponse): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  /** One refresh at a time; a rejected refresh token signs the user out. */
  function refresh(current: Tokens): Promise<Tokens> {
    refreshing ??= (async () => {
      try {
        const res = await send('/v1/auth/refresh', 'POST', json, { refreshToken: current.refreshToken });
        if (res.status === 401 || res.status === 400 || res.status === 403) {
          await deps.tokens.set(null);
          throw new AuthError('expired', res.status);
        }
        if (!res.ok) throw statusError(res.status);
        const next = tokensFrom(await readJson(res), current.email, now());
        if (!next) throw new AuthError('server', res.status);
        await deps.tokens.set(next);
        return next;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  return {
    async signIn(email, password) {
      const res = await send('/v1/auth/login', 'POST', json, { email: email.trim(), password });
      if (!res.ok) throw statusError(res.status);
      const tokens = tokensFrom(await readJson(res), email.trim(), now());
      if (!tokens) throw new AuthError('server', res.status);
      await deps.tokens.set(tokens);
      return tokens;
    },

    async signOut() {
      const tokens = await deps.tokens.get();
      await deps.tokens.set(null);
      if (tokens) {
        // Stateless on the server today; the call is a courtesy and its failure changes nothing.
        await send('/v1/auth/logout', 'POST', { authorization: `Bearer ${tokens.accessToken}` }).catch(() => undefined);
      }
    },

    async request(path, init = {}) {
      let tokens = await deps.tokens.get();
      if (!tokens) throw new AuthError('signedOut');
      if (tokens.expiresAt - REFRESH_MARGIN_MS <= now()) tokens = await refresh(tokens);
      const method = init.method ?? 'GET';
      const call = (t: Tokens) => send(path, method, { ...json, authorization: `Bearer ${t.accessToken}` }, init.body);
      let res = await call(tokens);
      if (res.status === 401) {
        tokens = await refresh(tokens);
        res = await call(tokens);
        if (res.status === 401) {
          await deps.tokens.set(null);
          throw new AuthError('expired', 401);
        }
      }
      return { status: res.status, ok: res.ok, body: await readJson(res) };
    },
  };
}
