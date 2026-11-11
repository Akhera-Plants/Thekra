import { describe, expect, it } from 'vitest';
import {
  addDays,
  createPlan,
  emptyStore,
  localChanges,
  logDone,
  updatePlan,
  upsertPlan,
  type Store,
  type SyncRequest,
  type SyncResponse,
} from '@thekra/practice-core';
import { ApiError } from '@/lib/types/api';
import { isOtherAccount, isTransientSyncError, pendingCount, retryDelayMs, syncUntilClean } from './sync-engine';

/**
 * A small in-memory server with the contract's merge rules for plans (last writer wins by clientUpdatedAt, a
 * tombstone wins ties) and logs (max). Each write records the server time, and a response returns everything
 * written after `since`.
 */
function fakeServer() {
  let clock = Date.parse('2026-10-28T10:00:00.000Z');
  const plans = new Map<string, { item: Record<string, unknown>; at: number }>();
  const logs = new Map<string, { item: { planId: string; date: string; amount: number }; at: number }>();
  const requests: SyncRequest[] = [];
  const post = async (request: SyncRequest): Promise<SyncResponse> => {
    requests.push(structuredClone(request));
    expect(JSON.stringify(request)).not.toContain('programs');
    clock += 1000;
    for (const plan of request.changes.plans) {
      const stored = plans.get(plan.id);
      const newer =
        !stored ||
        Date.parse(plan.clientUpdatedAt) > Date.parse(stored.item.clientUpdatedAt as string) ||
        (plan.clientUpdatedAt === stored.item.clientUpdatedAt && plan.deletedAt !== null && stored.item.deletedAt === null);
      if (newer) plans.set(plan.id, { item: { ...plan }, at: clock });
    }
    for (const log of request.changes.logs) {
      const key = `${log.planId}|${log.date}`;
      const stored = logs.get(key);
      if (!stored || log.amount > stored.item.amount) logs.set(key, { item: { ...log }, at: clock });
    }
    const since = request.since ? Date.parse(request.since) : -Infinity;
    return {
      serverTime: new Date(clock).toISOString(),
      settings: null,
      plans: [...plans.values()].filter((p) => p.at > since).map((p) => p.item) as SyncResponse['plans'],
      logs: [...logs.values()].filter((l) => l.at > since).map((l) => l.item),
      relatives: [],
      contacts: [],
    };
  };
  return { post, requests };
}

function device(initial: Store = emptyStore()) {
  let store = initial;
  return {
    read: () => store,
    write: (change: (s: Store) => Store) => {
      store = change(store);
    },
  };
}

const PLAN_ID = '3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b';

function plan(now = '2026-10-28T09:00:00.000Z') {
  return createPlan(
    {
      id: PLAN_ID,
      habitKey: 'quran-wird',
      deedSlug: 'quran',
      title: 'ورد القرآن',
      unit: 'minutes',
      amount: 5,
      activeDaysPerWeek: 3,
      slots: ['06:00', '21:00'],
      createdOn: '2026-10-28',
    },
    now,
  );
}

describe('practice sync run', () => {
  it('carries a plan and its log from one device to another, and back', async () => {
    const server = fakeServer();
    const a = device(upsertPlan(emptyStore(), logDone(plan(), '2026-10-28', 3), '2026-10-28T09:00:00.000Z'));
    const b = device();

    expect(await syncUntilClean({ ...a, post: server.post })).toEqual({ rounds: 1, pending: 0 });
    await syncUntilClean({ ...b, post: server.post });
    expect(b.read().plans[0]).toMatchObject({ id: PLAN_ID, habitKey: 'quran-wird', amount: 5, log: { '2026-10-28': 3 } });

    // B finishes the day's amount; A sees the higher log (max wins) after its next run.
    b.write((s) => updatePlan(s, PLAN_ID, (p) => logDone(p, '2026-10-28', 2)));
    expect(pendingCount(b.read())).toBe(1);
    await syncUntilClean({ ...b, post: server.post });
    await syncUntilClean({ ...a, post: server.post });
    expect(a.read().plans[0]?.log['2026-10-28']).toBe(5);
    expect(pendingCount(a.read())).toBe(0);
  });

  it('always pulls once, even with nothing to send', async () => {
    const server = fakeServer();
    const a = device();
    await syncUntilClean({ ...a, post: server.post });
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.changes).toEqual({ plans: [], logs: [], relatives: [], contacts: [] });
  });

  it('keeps an edit made while a request was in flight pending for the next run', async () => {
    const server = fakeServer();
    const a = device(upsertPlan(emptyStore(), plan(), '2026-10-28T09:00:00.000Z'));
    const result = await syncUntilClean({
      ...a,
      post: async (request) => {
        const response = await server.post(request);
        // The visitor logs while the answer is on its way: the merge must not mark it as synced.
        a.write((s) => updatePlan(s, PLAN_ID, (p) => logDone(p, '2026-10-28', 1)));
        return response;
      },
      maxRounds: 1,
    });
    expect(result.pending).toBe(1);
    expect(localChanges(a.read()).logs).toEqual([{ planId: PLAN_ID, date: '2026-10-28', amount: 1 }]);
  });

  it('sends a large first sync in several rounds of at most 500 items', async () => {
    const server = fakeServer();
    let p = plan();
    for (let i = 0; i < 700; i++) p = logDone(p, addDays('2024-11-01', i), 1 + (i % 5));
    const a = device(upsertPlan(emptyStore(), p, '2026-10-28T09:00:00.000Z'));
    const result = await syncUntilClean({ ...a, post: server.post });
    expect(result.pending).toBe(0);
    expect(result.rounds).toBeGreaterThan(1);
    for (const request of server.requests) {
      const c = request.changes;
      expect(c.plans.length + c.logs.length + c.relatives.length + c.contacts.length).toBeLessThanOrEqual(500);
    }
  });

  it('stops after the round limit when the server keeps refusing an item silently', async () => {
    const a = device(upsertPlan(emptyStore(), plan(), '2026-10-28T09:00:00.000Z'));
    const result = await syncUntilClean({
      ...a,
      post: async () => ({
        serverTime: '2026-10-28T10:00:00.000Z',
        settings: null,
        plans: [],
        logs: [],
        relatives: [],
        contacts: [],
      }),
      maxRounds: 3,
    });
    expect(result).toEqual({ rounds: 3, pending: 1 });
  });
});

describe('sync timing and errors', () => {
  it('backs off from 5 s, doubling, up to 5 minutes', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([5000, 10000, 20000, 40000]);
    expect(retryDelayMs(20)).toBe(300000);
  });

  it('retries connection trouble and server errors, not refused data', () => {
    const err = (status: number, kind: 'http' | 'network' | 'timeout' | 'validation' = 'http') =>
      new ApiError({ code: 'X', message: 'x', status, kind });
    expect(isTransientSyncError(err(0, 'network'))).toBe(true);
    expect(isTransientSyncError(err(0, 'timeout'))).toBe(true);
    expect(isTransientSyncError(err(503))).toBe(true);
    expect(isTransientSyncError(err(429))).toBe(true);
    expect(isTransientSyncError(err(400))).toBe(false);
    expect(isTransientSyncError(err(422))).toBe(false);
  });

  it('notices a copy synced with another account', () => {
    expect(isOtherAccount(undefined, 'u2')).toBe(false);
    expect(isOtherAccount('u2', 'u2')).toBe(false);
    expect(isOtherAccount('u1', 'u2')).toBe(true);
  });
});
