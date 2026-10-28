import {
  checkIn,
  createPlan,
  createRelative,
  emptyStore,
  logDone,
  startProgram,
  updateSettings,
  upsertPlan,
  upsertRelative,
  type Store,
} from '@thekra/practice-core';
import { describe, expect, it } from 'vitest';
import { AuthError, createAuthClient, type HttpFetch, type Tokens, type TokenStore } from '../src/auth.js';
import { containsPrograms, extensionRequest, pendingCount, runSync, SYNC_PATH, type SyncDeps } from '../src/sync-runner.js';

const T0 = '2026-10-28T08:00:00.000Z';
const PLAN = '0d1c7d36-0b8e-4d1a-9a59-6c0b6f0f2a11';
const WEB_PLAN = '9f8e7d6c-5b4a-4321-8fed-cba987654321';
const REL = '7b2f3c44-1a2b-4c3d-9e8f-0a1b2c3d4e5f';
const API = 'https://thekra.vercel.app';

/** A store with everything the extension must never send: a sin program (with a note), a relative, settings. */
function richStore(): Store {
  let store = emptyStore();
  const plan = logDone(
    createPlan({ id: PLAN, habitKey: 'duha', rule: { kind: 'daily' }, deedSlug: 'nawafil', title: 'صلاة الضحى', unit: 'times', amount: 1, activeDaysPerWeek: 3, slots: ['09:30'], createdOn: '2026-10-20' }, T0),
    '2026-10-28',
    1,
  );
  store = upsertPlan(store, plan, T0);
  store = upsertRelative(store, createRelative({ id: REL, name: 'خالتي', relation: 'خالة', rule: { kind: 'weekdays', days: [5] } }, T0), T0);
  store = updateSettings(store, { hijriOffset: 1 }, T0);
  const program = checkIn(startProgram({ sinSlug: 'secret-sin', category: 'haqq_allah', startedOn: '2026-10-01', hardToLeaveAtOnce: true }), '2026-10-27', 'held', 'private note');
  return { ...store, programs: [program] };
}

/** In-memory storage + a fake API that stores what it receives and echoes it back (like the real server). */
function harness(initial: Store, opts: { status?: number; extraResponse?: Record<string, unknown>; onLoad?: (n: number, s: Store) => Store } = {}) {
  let stored = initial;
  let loads = 0;
  const bodies: unknown[] = [];
  const deps: SyncDeps = {
    async request(path, init) {
      expect(path).toBe(SYNC_PATH);
      expect(init.method).toBe('POST');
      bodies.push(JSON.parse(JSON.stringify(init.body)));
      if (opts.status && opts.status !== 200) return { status: opts.status, ok: false, body: { error: { code: 'X' } } };
      const req = init.body as { changes: { plans: unknown[]; logs: unknown[] } };
      return {
        status: 200,
        ok: true,
        body: {
          data: {
            serverTime: `2026-10-28T09:00:0${bodies.length}.000Z`,
            settings: null,
            plans: req.changes.plans,
            logs: req.changes.logs,
            relatives: [],
            contacts: [],
            ...opts.extraResponse,
          },
        },
      };
    },
    async loadStore() {
      loads++;
      return opts.onLoad ? opts.onLoad(loads, stored) : stored;
    },
    async saveStore(s) {
      stored = s;
    },
    now: () => new Date('2026-10-28T09:00:30.000Z'),
  };
  return { deps, bodies, get stored() {
    return stored;
  } };
}

describe('sync runner', () => {
  it('sends plans and logs only: never programs, relatives, contacts or settings', async () => {
    const h = harness(richStore());
    const status = await runSync(h.deps);
    expect(status).toEqual({ state: 'ok', at: '2026-10-28T09:00:30.000Z', lastOkAt: '2026-10-28T09:00:30.000Z' });
    expect(h.bodies).toHaveLength(1);
    const body = h.bodies[0] as { since: unknown; changes: Record<string, unknown[]> };
    expect(body.since).toBeNull();
    expect(Object.keys(body.changes).sort()).toEqual(['contacts', 'logs', 'plans', 'relatives']);
    expect(body.changes.plans).toHaveLength(1);
    expect(body.changes.logs).toEqual([{ planId: PLAN, date: '2026-10-28', amount: 1 }]);
    expect(body.changes.relatives).toEqual([]);
    expect(body.changes.contacts).toEqual([]);
    const text = JSON.stringify(h.bodies);
    for (const secret of ['programs', 'secret-sin', 'private note', 'خالتي', 'hijriOffset']) expect(text).not.toContain(secret);
    expect(containsPrograms(h.bodies)).toBe(false);
  });

  it('merges the answer, keeps relatives and settings, and has nothing left to send', async () => {
    const webPlan = {
      id: WEB_PLAN, habitKey: 'witr', deedSlug: 'nawafil', title: 'الوتر', unit: 'times', amount: 1, ceiling: null, activeDaysPerWeek: 4,
      slots: ['22:00'], rule: { kind: 'daily' }, createdOn: '2026-10-25', amountChangedOn: '2026-10-25', ebbSince: null, season: null,
      clientUpdatedAt: '2026-10-27T10:00:00.000Z', deletedAt: null,
    };
    const h = harness(richStore(), {
      extraResponse: {
        settings: { hijriOffset: 0, reminderTimes: [], freeMinutesPerDay: null, clientUpdatedAt: '2026-10-28T08:30:00.000Z' },
        relatives: [{ id: '3c4d5e6f-1111-4222-8333-444455556666', name: 'جدتي', relation: 'جدة', rule: { kind: 'weekdays', days: [5] }, lastContactedOn: null, clientUpdatedAt: T0, deletedAt: null }],
        contacts: [{ relativeId: '3c4d5e6f-1111-4222-8333-444455556666', date: '2026-10-20', deleted: false }],
      },
    });
    await runSync(h.deps);
    // The echo of our own items plus the web plan.
    const firstAnswerPlans = [webPlan];
    const h2 = harness(h.stored, { extraResponse: { plans: firstAnswerPlans } });
    await runSync(h2.deps);
    const s = h2.stored;
    expect(s.plans.map((p) => p.id).sort()).toEqual([PLAN, WEB_PLAN].sort());
    expect(s.relatives.map((r) => r.name).sort()).toEqual(['جدتي', 'خالتي']);
    expect(s.relatives.find((r) => r.name === 'جدتي')?.history).toEqual(['2026-10-20']);
    expect(s.settings.hijriOffset).toBe(0); // the account's newer settings win locally
    expect(s.programs).toHaveLength(1); // still on the device, never sent
    expect(s.sync.lastSyncedAt).toBe('2026-10-28T09:00:01.000Z');
    expect(pendingCount(s)).toBe(0);
    expect(extensionRequest(s).since).toBe('2026-10-28T09:00:01.000Z');
  });

  it('keeps an edit made while the request was in flight and sends it in the next round', async () => {
    const h = harness(richStore(), {
      // The second load (after the answer) sees a log added meanwhile by the popup.
      onLoad: (n, s) => (n === 2 ? { ...s, plans: s.plans.map((p) => logDone(p, '2026-10-29', 1)) } : s),
    });
    await runSync(h.deps);
    expect(h.stored.plans[0]?.log['2026-10-29']).toBe(1);
    expect(h.bodies).toHaveLength(2);
    expect((h.bodies[1] as { changes: { logs: unknown[] } }).changes.logs).toEqual([{ planId: PLAN, date: '2026-10-29', amount: 1 }]);
    expect(pendingCount(h.stored)).toBe(0);
  });

  it('sends a large first sync in several rounds of at most 500 items', async () => {
    let plan = createPlan({ id: PLAN, habitKey: 'duha', deedSlug: 'nawafil', title: 'x', unit: 'times', amount: 1, activeDaysPerWeek: 3, slots: ['09:30'], createdOn: '2024-01-01' }, T0);
    for (let i = 0; i < 700; i++) plan = logDone(plan, new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10), 1);
    const h = harness(upsertPlan(emptyStore(), plan, T0));
    expect((await runSync(h.deps)).state).toBe('ok');
    const sizes = h.bodies.map((b) => {
      const c = (b as { changes: { plans: unknown[]; logs: unknown[] } }).changes;
      return c.plans.length + c.logs.length;
    });
    expect(sizes).toEqual([500, 201]);
    expect(pendingCount(h.stored)).toBe(0);
  });

  it('reports API errors without touching the store', async () => {
    for (const [status, error] of [[422, 'limit'], [413, 'tooLarge'], [400, 'invalid'], [500, 'server']] as const) {
      const initial = richStore();
      const h = harness(initial, { status });
      const out = await runSync(h.deps, { state: 'ok', at: T0, lastOkAt: T0 });
      expect(out).toMatchObject({ state: 'error', error, lastOkAt: T0 });
      expect(h.stored).toBe(initial);
    }
  });

  it('reports sign-out when the session cannot be refreshed, and offline when the network fails', async () => {
    const base = harness(richStore()).deps;
    expect(await runSync({ ...base, request: () => Promise.reject(new AuthError('expired', 401)) })).toMatchObject({ state: 'signedOut', error: 'expired' });
    expect(await runSync({ ...base, request: () => Promise.reject(new AuthError('offline')) })).toMatchObject({ state: 'error', error: 'offline' });
  });

  it('refuses to send any body with a programs key', () => {
    expect(containsPrograms({ changes: { plans: [{ id: 'x', programs: [] }] } })).toBe(true);
    expect(containsPrograms(extensionRequest(richStore()))).toBe(false);
  });
});

// ---- Auth --------------------------------------------------------------------------------------------------

function memoryTokens(initial: Tokens | null): TokenStore & { value: Tokens | null } {
  const box = {
    value: initial,
    async get() {
      return box.value;
    },
    async set(t: Tokens | null) {
      box.value = t;
    },
  };
  return box;
}

type Route = (body: unknown, headers: Record<string, string>) => { status: number; body?: unknown };

function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; method: string; auth?: string; body?: unknown }[] = [];
  const fetch: HttpFetch = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method, auth: init.headers.authorization, body });
    const route = routes[`${init.method} ${url.replace(API, '')}`];
    if (!route) throw new Error(`no route ${url}`);
    const res = route(body, init.headers);
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.body ?? null };
  };
  return { fetch, calls };
}

const NOW = 1_800_000_000_000;
const fresh = (access: string, refresh: string, expiresAt = NOW + 15 * 60_000): Tokens => ({ accessToken: access, refreshToken: refresh, expiresAt, email: 'a@b.c' });

describe('auth client', () => {
  it('signs in and stores the tokens with their expiry (never the password)', async () => {
    const tokens = memoryTokens(null);
    const { fetch, calls } = fakeFetch({
      'POST /v1/auth/login': (b) => {
        expect(b).toEqual({ email: 'a@b.c', password: 'pw' });
        return { status: 200, body: { data: { user: { id: 'u', email: 'a@b.c' }, accessToken: 'A1', refreshToken: 'R1', expiresIn: 900 } } };
      },
    });
    const client = createAuthClient({ fetch, tokens, now: () => NOW });
    await client.signIn(' a@b.c ', 'pw');
    expect(tokens.value).toEqual({ accessToken: 'A1', refreshToken: 'R1', expiresAt: NOW + 900_000, email: 'a@b.c' });
    expect(JSON.stringify(tokens.value)).not.toContain('pw');
    expect(calls).toHaveLength(1);
  });

  it('maps a wrong password, throttling and no network', async () => {
    const tokens = memoryTokens(null);
    const make = (status: number) => createAuthClient({ fetch: fakeFetch({ 'POST /v1/auth/login': () => ({ status }) }).fetch, tokens });
    await expect(make(401).signIn('a@b.c', 'x')).rejects.toMatchObject({ code: 'invalid' });
    await expect(make(429).signIn('a@b.c', 'x')).rejects.toMatchObject({ code: 'throttled' });
    const offline = createAuthClient({ fetch: () => Promise.reject(new TypeError('Failed to fetch')), tokens });
    await expect(offline.signIn('a@b.c', 'x')).rejects.toMatchObject({ code: 'offline' });
    expect(tokens.value).toBeNull();
  });

  it('refreshes on 401 and retries once with the new token', async () => {
    const tokens = memoryTokens(fresh('OLD', 'R1'));
    const { fetch, calls } = fakeFetch({
      'POST /v1/me/practice/sync': (_b, h) => (h.authorization === 'Bearer NEW' ? { status: 200, body: { data: { ok: 1 } } } : { status: 401 }),
      'POST /v1/auth/refresh': (b) => {
        expect(b).toEqual({ refreshToken: 'R1' });
        return { status: 200, body: { data: { accessToken: 'NEW', refreshToken: 'R2', expiresIn: 900 } } };
      },
    });
    const client = createAuthClient({ fetch, tokens, now: () => NOW });
    const res = await client.request(SYNC_PATH, { method: 'POST', body: { since: null } });
    expect(res).toEqual({ status: 200, ok: true, body: { data: { ok: 1 } } });
    expect(calls.map((c) => `${c.method} ${c.url.replace(API, '')} ${c.auth ?? ''}`)).toEqual([
      'POST /v1/me/practice/sync Bearer OLD',
      'POST /v1/auth/refresh ',
      'POST /v1/me/practice/sync Bearer NEW',
    ]);
    expect(tokens.value).toMatchObject({ accessToken: 'NEW', refreshToken: 'R2', email: 'a@b.c' });
  });

  it('refreshes ahead of expiry, once for concurrent requests', async () => {
    const tokens = memoryTokens(fresh('OLD', 'R1', NOW + 10_000));
    let refreshes = 0;
    const { fetch } = fakeFetch({
      'POST /v1/auth/refresh': () => {
        refreshes++;
        return { status: 200, body: { data: { accessToken: 'NEW', refreshToken: 'R2', expiresIn: 900 } } };
      },
      'GET /v1/me/practice': (_b, h) => ({ status: h.authorization === 'Bearer NEW' ? 200 : 401, body: { data: {} } }),
    });
    const client = createAuthClient({ fetch, tokens, now: () => NOW });
    const results = await Promise.all([client.request('/v1/me/practice'), client.request('/v1/me/practice')]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(refreshes).toBe(1);
  });

  it('signs out (keeping nothing but local data) when the refresh token is rejected', async () => {
    const tokens = memoryTokens(fresh('OLD', 'BAD'));
    const { fetch } = fakeFetch({
      'POST /v1/me/practice/sync': () => ({ status: 401 }),
      'POST /v1/auth/refresh': () => ({ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }),
    });
    const client = createAuthClient({ fetch, tokens, now: () => NOW });
    await expect(client.request(SYNC_PATH, { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'expired' });
    expect(tokens.value).toBeNull();
    await expect(client.request(SYNC_PATH, { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'signedOut' });
  });

  it('sign-out drops the tokens even when the API is unreachable', async () => {
    const tokens = memoryTokens(fresh('A', 'R'));
    const client = createAuthClient({ fetch: () => Promise.reject(new TypeError('offline')), tokens });
    await client.signOut();
    expect(tokens.value).toBeNull();
  });
});
