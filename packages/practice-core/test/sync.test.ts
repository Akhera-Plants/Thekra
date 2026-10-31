import { describe, expect, it } from 'vitest';
import {
  applyServerChanges,
  buildSyncRequest,
  checkIn,
  compareVersions,
  correctLog,
  countChanges,
  createPlan,
  createRelative,
  deletePlan,
  deleteRelative,
  emptyStore,
  localChanges,
  logContact,
  logDone,
  startProgram,
  undoContact,
  undoLastContact,
  updatePlan,
  updateRelative,
  updateSettings,
  upsertPlan,
  upsertRelative,
  type Plan,
  type Store,
  type SyncChanges,
  type SyncResponse,
  type WirePlanItem,
} from '../src/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────────────────

let clock = Date.parse('2026-10-28T08:00:00.000Z');
/** A strictly increasing ISO time. */
function tick(): string {
  clock += 1000;
  return new Date(clock).toISOString();
}
const at = (minutes: number) => new Date(Date.parse('2026-10-28T08:00:00.000Z') + minutes * 60_000).toISOString();

function plan(id: string, now: string, title = 'قراءة'): Plan {
  return createPlan(
    { id, deedSlug: 'qiraat', title, unit: 'minutes', amount: 5, activeDaysPerWeek: 4, slots: ['06:00', '21:00'], createdOn: '2026-10-01' },
    now,
  );
}

/** A response built from a changes body (what the server returns for those items). */
function asResponse(changes: SyncChanges, serverTime: string): SyncResponse {
  return {
    serverTime,
    settings: changes.settings ?? null,
    plans: changes.plans,
    logs: changes.logs,
    relatives: changes.relatives,
    contacts: changes.contacts,
  };
}

/**
 * A fake server built from the same merge rules: it applies a device's changes, then answers with its whole state.
 * This is how the contract describes the server (same rules as practice-core).
 */
class FakeServer {
  state: Store = emptyStore();
  sync(device: Store, opts: { maxItems?: number } = {}): Store {
    const req = buildSyncRequest(device, opts);
    const t = tick();
    this.state = applyServerChanges(this.state, asResponse(req.changes, t));
    const snapshot = localChanges(this.state, { includeAcked: true, maxItems: Number.POSITIVE_INFINITY });
    return applyServerChanges(device, asResponse(snapshot, t));
  }
}

/** The data both replicas must agree on. */
function data(s: Store) {
  const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    plans: byId(s.plans).map((p) => ({ ...p, log: Object.fromEntries(Object.entries(p.log).sort()) })),
    relatives: byId(s.relatives).map((r) => ({ ...r, history: [...r.history].sort() })),
    settings: s.settings,
    tombstones: s.tombstones
      .filter((t) => t.kind !== 'contact')
      .sort((a, b) => (`${a.kind}${a.id}` < `${b.kind}${b.id}` ? -1 : 1)),
  };
}

/** Small seeded PRNG (mulberry32) so property tests are reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

/** A random server response over a small id pool, with colliding times and tombstones. */
function randomResponse(r: () => number, n: number): SyncResponse {
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)] as T;
  const time = () => at(pick([1, 2, 3, 4, 5]));
  const plans: WirePlanItem[] = [];
  for (const id of ['p1', 'p2', 'p3']) {
    if (r() < 0.3) continue;
    const t = time();
    if (r() < 0.25) plans.push({ id, clientUpdatedAt: t, deletedAt: t });
    else {
      const p = plan(id, t, pick(['أ', 'ب', 'ج']));
      plans.push({ ...localChanges({ ...emptyStore(), plans: [{ ...p, amount: pick([2, 5, 7]) }] }).plans[0]!, clientUpdatedAt: t } as WirePlanItem);
    }
  }
  // Like the server: a response only carries logs of plans the client knows (sent in the same response here).
  const planIds = plans.map((p) => p.id);
  const logs = planIds.length === 0 ? [] : Array.from({ length: 4 }, () => ({ planId: pick(planIds), date: pick(['2026-10-01', '2026-10-02']), amount: pick([1, 3, 5, 10]) }));
  const relatives = ['r1', 'r2'].flatMap((id) => {
    if (r() < 0.4) return [];
    const t = time();
    if (r() < 0.25) return [{ id, clientUpdatedAt: t, deletedAt: t }];
    const rel = createRelative({ id, name: pick(['خالتي', 'عمي', 'جدتي']), relation: 'x', rule: { kind: 'everyNDays', n: pick([7, 14]), anchor: '2026-10-01' } }, t);
    return [{ ...localChanges({ ...emptyStore(), relatives: [rel] }).relatives[0]!, clientUpdatedAt: t }];
  });
  const settings = r() < 0.6 ? { hijriOffset: pick([-1, 0, 1]), reminderTimes: [pick(['07:00', '08:00'])], freeMinutesPerDay: pick([60, 120, null]), clientUpdatedAt: time() } : null;
  return { serverTime: at(100 + n), settings, plans, logs, relatives: relatives as SyncResponse['relatives'], contacts: [] };
}

// ── Tests ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('compareVersions', () => {
  it('is a total order: time, then tombstone, then content', () => {
    const live = (time: number, content: string) => ({ time, deleted: false, content });
    expect(compareVersions(live(2, 'a'), live(1, 'z'))).toBeGreaterThan(0);
    expect(compareVersions({ time: 1, deleted: true, content: '' }, live(1, 'z'))).toBeGreaterThan(0);
    expect(compareVersions(live(1, 'b'), live(1, 'a'))).toBeGreaterThan(0);
    expect(compareVersions(live(1, 'a'), live(1, 'a'))).toBe(0);
  });
});

describe('localChanges', () => {
  it('matches the contract wire shapes', () => {
    let s = upsertPlan(emptyStore(), { ...plan('p1', at(1)), habitKey: 'duha', ceiling: 10 }, at(1));
    s = updatePlan(s, 'p1', (p) => logDone(p, '2026-10-02', 3), at(2));
    s = upsertRelative(s, createRelative({ id: 'r1', name: 'خالتي', relation: 'خالة', rule: { kind: 'weekdays', days: [5] } }, at(1)), at(1));
    s = updateRelative(s, 'r1', (r) => logContact(r, '2026-10-20'), at(2));
    s = updateSettings(s, { hijriOffset: 1, reminderTimes: ['07:00'] }, at(3));
    const c = localChanges(s);
    expect(c.settings).toEqual({ hijriOffset: 1, reminderTimes: ['07:00'], freeMinutesPerDay: null, clientUpdatedAt: at(3) });
    expect(c.plans).toEqual([
      {
        id: 'p1',
        habitKey: 'duha',
        deedSlug: 'qiraat',
        title: 'قراءة',
        unit: 'minutes',
        amount: 5,
        ceiling: 10,
        activeDaysPerWeek: 4,
        slots: ['06:00', '21:00'],
        rule: null,
        createdOn: '2026-10-01',
        amountChangedOn: '2026-10-01',
        ebbSince: null,
        season: null,
        clientUpdatedAt: at(1),
        deletedAt: null,
      },
    ]);
    expect(c.logs).toEqual([{ planId: 'p1', date: '2026-10-02', amount: 3 }]);
    expect(c.relatives).toEqual([
      { id: 'r1', name: 'خالتي', relation: 'خالة', rule: { kind: 'weekdays', days: [5] }, lastContactedOn: '2026-10-20', clientUpdatedAt: at(1), deletedAt: null },
    ]);
    expect(c.contacts).toEqual([{ relativeId: 'r1', date: '2026-10-20', deleted: false }]);
    expect(buildSyncRequest(s).since).toBeNull();
  });

  it('sends tombstones with clientUpdatedAt = deletedAt', () => {
    let s = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    s = deletePlan(s, 'p1', at(5));
    s = deleteRelative(s, 'r9', at(6));
    const c = localChanges(s);
    expect(c.plans).toEqual([{ id: 'p1', clientUpdatedAt: at(5), deletedAt: at(5) }]);
    expect(c.relatives).toEqual([{ id: 'r9', clientUpdatedAt: at(6), deletedAt: at(6) }]);
  });

  it('is empty after a sync round trip, and only new edits are pending', () => {
    const server = new FakeServer();
    let s = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    s = updatePlan(s, 'p1', (p) => logDone(p, '2026-10-02', 3), at(1));
    s = server.sync(s);
    expect(countChanges(localChanges(s))).toBe(0);
    expect(s.sync.lastSyncedAt).not.toBeNull();
    s = updatePlan(s, 'p1', (p) => logDone(p, '2026-10-02', 2), at(2));
    expect(localChanges(s)).toMatchObject({ plans: [], logs: [{ planId: 'p1', date: '2026-10-02', amount: 5 }] });
  });

  it('does not depend on the device clock: an edit stamped before lastSyncedAt is still sent', () => {
    const server = new FakeServer();
    let s = server.sync(upsertPlan(emptyStore(), plan('p1', at(1)), at(1)));
    s = updatePlan(s, 'p1', (p) => ({ ...p, title: 'ساعة الجهاز متأخرة' }), '2020-01-01T00:00:00.000Z');
    expect(localChanges(s).plans.map((p) => p.title)).toEqual(['ساعة الجهاز متأخرة']);
  });

  it('chunks a large first sync, parents first, and converges', () => {
    const server = new FakeServer();
    let s = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    for (let d = 1; d <= 9; d++) s = updatePlan(s, 'p1', (p) => logDone(p, `2026-10-0${d}`, d), at(1));
    const first = localChanges(s, { maxItems: 4 });
    expect(countChanges(first)).toBe(4);
    expect(first.plans).toHaveLength(1);
    let rounds = 0;
    while (countChanges(localChanges(s)) > 0 && rounds < 10) {
      s = server.sync(s, { maxItems: 4 });
      rounds++;
    }
    expect(rounds).toBe(3);
    expect(Object.keys(server.state.plans[0]?.log ?? {})).toHaveLength(9);
  });

  it('never contains programs, slugs or notes', () => {
    const r = rng(7);
    for (let i = 0; i < 20; i++) {
      let s = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
      const slug = `sin-${Math.floor(r() * 1e6)}`;
      const note = `ملاحظة سرية ${i}`;
      s = { ...s, programs: [checkIn(startProgram({ sinSlug: slug, category: 'haqq_allah', hardToLeaveAtOnce: r() < 0.5, startedOn: '2026-10-01' }), '2026-10-02', 'weak', note)] };
      for (const body of [localChanges(s), localChanges(s, { includeAcked: true }), buildSyncRequest(s)]) {
        const text = JSON.stringify(body);
        expect(text).not.toContain(slug);
        expect(text).not.toContain(note);
        expect(text).not.toMatch(/"programs"|checkIns|haqq_/);
      }
    }
  });
});

describe('applyServerChanges', () => {
  it('sets lastSyncedAt = serverTime, accepts the { data } envelope, and rejects a body without serverTime', () => {
    const resp = { data: { serverTime: at(10), settings: null, plans: [], logs: [], relatives: [], contacts: [] } };
    expect(applyServerChanges(emptyStore(), resp).sync.lastSyncedAt).toBe(at(10));
    expect(() => applyServerChanges(emptyStore(), { plans: [] })).toThrow(TypeError);
  });

  it('last writer wins for plans, relatives and settings', () => {
    let s = upsertPlan(emptyStore(), plan('p1', at(2), 'محلي'), at(2));
    s = updateSettings(s, { hijriOffset: 1 }, at(2));
    const older = localChanges(upsertPlan(emptyStore(), plan('p1', at(1), 'قديم'), at(1)));
    const newer = localChanges(upsertPlan(emptyStore(), plan('p1', at(3), 'أحدث'), at(3)));
    expect(applyServerChanges(s, asResponse(older, at(10))).plans[0]?.title).toBe('محلي');
    expect(applyServerChanges(s, asResponse(newer, at(10))).plans[0]?.title).toBe('أحدث');
    const settingsResp = { ...asResponse(older, at(10)), settings: { hijriOffset: -1, reminderTimes: [], freeMinutesPerDay: null, updatedAt: at(3) } };
    expect(applyServerChanges(s, settingsResp).settings).toEqual({ hijriOffset: -1, updatedAt: at(3) });
  });

  it('a tombstone older than an edit loses; a newer one wins', () => {
    const live = upsertPlan(emptyStore(), plan('p1', at(5)), at(5));
    const oldDelete: WirePlanItem = { id: 'p1', clientUpdatedAt: at(4), deletedAt: at(4) };
    const newDelete: WirePlanItem = { id: 'p1', clientUpdatedAt: at(6), deletedAt: at(6) };
    const base = { serverTime: at(10), settings: null, logs: [], relatives: [], contacts: [] };
    expect(applyServerChanges(live, { ...base, plans: [oldDelete] }).plans).toHaveLength(1);
    const gone = applyServerChanges(live, { ...base, plans: [newDelete] });
    expect(gone.plans).toEqual([]);
    expect(gone.tombstones).toEqual([{ kind: 'plan', id: 'p1', deletedAt: at(6) }]);
    // Local tombstone vs incoming edit.
    const deleted = deletePlan(live, 'p1', at(7));
    const olderEdit = localChanges(upsertPlan(emptyStore(), plan('p1', at(6)), at(6)));
    const newerEdit = localChanges(upsertPlan(emptyStore(), plan('p1', at(8)), at(8)));
    expect(applyServerChanges(deleted, asResponse(olderEdit, at(10))).plans).toEqual([]);
    const back = applyServerChanges(deleted, asResponse(newerEdit, at(10)));
    expect(back.plans.map((p) => p.id)).toEqual(['p1']);
    expect(back.tombstones).toEqual([]);
  });

  it('keeps the local log of a plan replaced by a newer server version, merging logs by max', () => {
    let s = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    s = updatePlan(s, 'p1', (p) => logDone(logDone(p, '2026-10-02', 7), '2026-10-03', 1), at(1));
    const server = localChanges(upsertPlan(emptyStore(), plan('p1', at(3), 'جديد'), at(3)));
    const merged = applyServerChanges(s, {
      ...asResponse(server, at(10)),
      logs: [
        { planId: 'p1', date: '2026-10-02', amount: 4 },
        { planId: 'p1', date: '2026-10-03', amount: 6 },
        { planId: 'missing', date: '2026-10-03', amount: 6 },
      ],
    });
    expect(merged.plans[0]?.title).toBe('جديد');
    expect(merged.plans[0]?.log).toEqual({ '2026-10-02': 7, '2026-10-03': 6 });
    // The server holds 6 for the 3rd but only 4 for the 2nd: the 2nd is still pending.
    expect(localChanges(merged).logs).toEqual([{ planId: 'p1', date: '2026-10-02', amount: 7 }]);
  });

  it('skips invalid items (validation, contact details)', () => {
    const resp: SyncResponse = {
      serverTime: at(10),
      settings: { hijriOffset: 9, reminderTimes: [], freeMinutesPerDay: null, clientUpdatedAt: at(1) },
      plans: [{ id: 'bad', clientUpdatedAt: at(1), deletedAt: null } as unknown as WirePlanItem],
      logs: [{ planId: 'bad', date: '2026-02-30', amount: 1 }],
      relatives: [{ id: 'r1', name: '0791234567', relation: '', rule: { kind: 'weekdays', days: [5] }, lastContactedOn: null, clientUpdatedAt: at(1), deletedAt: null }],
      contacts: [{ relativeId: 'r1', date: '2026-10-01', deleted: false }],
    };
    const s = applyServerChanges(emptyStore(), resp);
    expect(s.plans).toEqual([]);
    expect(s.relatives).toEqual([]);
    expect(s.settings).toEqual({ hijriOffset: 0 });
  });
});

describe('properties', () => {
  it('applying responses in any order converges (plans, relatives, settings, logs, tombstones)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed);
      const responses = [randomResponse(r, 1), randomResponse(r, 2), randomResponse(r, 3)];
      let base = upsertPlan(emptyStore(), plan('p1', at(3), 'محلي'), at(3));
      base = updatePlan(base, 'p1', (p) => logDone(p, '2026-10-01', 4), at(3));
      const results = permutations(responses).map((order) => order.reduce((s, resp) => applyServerChanges(s, resp), base));
      const first = data(results[0]!);
      for (const res of results.slice(1)) {
        const d = data(res);
        expect(d.plans).toEqual(first.plans);
        expect(d.relatives.map(({ history: _h, lastContactedOn: _l, ...rest }) => rest)).toEqual(
          first.relatives.map(({ history: _h, lastContactedOn: _l, ...rest }) => rest),
        );
        expect(d.settings).toEqual(first.settings);
        expect(d.tombstones).toEqual(first.tombstones);
      }
    }
  });

  it('logs never decrease', () => {
    for (let seed = 100; seed < 130; seed++) {
      const r = rng(seed);
      let s = upsertPlan(emptyStore(), plan('p1', at(5)), at(5));
      s = updatePlan(s, 'p1', (p) => logDone(p, '2026-10-01', 4), at(5));
      for (let i = 0; i < 5; i++) {
        const before = new Map(s.plans.map((p) => [p.id, p.log]));
        s = applyServerChanges(s, randomResponse(r, i));
        for (const p of s.plans) {
          for (const [date, amount] of Object.entries(before.get(p.id) ?? {})) {
            // A plan replaced by a newer server version keeps its log, so nothing goes down.
            expect(p.log[date] ?? 0).toBeGreaterThanOrEqual(amount);
          }
        }
      }
    }
  });

  it('two devices syncing in either order reach the same state', () => {
    const run = (order: ('A' | 'B')[]) => {
      clock = Date.parse('2026-10-28T09:00:00.000Z');
      const server = new FakeServer();
      // Shared start: both devices have the plan and the relative.
      let a = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
      a = upsertRelative(a, createRelative({ id: 'r1', name: 'خالتي', relation: 'خالة', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } }, at(1)), at(1));
      a = updateRelative(a, 'r1', (x) => logContact(x, '2026-10-10'), at(1));
      a = server.sync(a);
      let b = server.sync(emptyStore());
      expect(data(b)).toEqual(data(a));
      // Offline edits.
      a = updatePlan(a, 'p1', (p) => logDone(p, '2026-10-20', 3), at(2));
      a = updatePlan(a, 'p1', (p) => ({ ...p, title: 'من أ' }), at(3));
      a = undoContact(a, 'r1', at(3));
      a = deleteRelative(upsertRelative(a, createRelative({ id: 'r2', name: 'عمي', relation: '', rule: { kind: 'weekdays', days: [1] } }, at(2)), at(2)), 'r2', at(4));
      b = updatePlan(b, 'p1', (p) => logDone(p, '2026-10-20', 5), at(2));
      b = updatePlan(b, 'p1', (p) => ({ ...p, slots: ['05:00'] }), at(4));
      b = updateRelative(b, 'r1', (x) => logContact(x, '2026-10-21'), at(4));
      b = updateSettings(b, { hijriOffset: -1 }, at(5));
      b = upsertPlan(b, plan('p2', at(5), 'جديد من ب'), at(5));
      for (const who of order) {
        if (who === 'A') a = server.sync(a);
        else b = server.sync(b);
      }
      return { a: data(a), b: data(b), server: data(server.state) };
    };
    const ab = run(['A', 'B', 'A']);
    const ba = run(['B', 'A', 'B']);
    for (const res of [ab, ba]) {
      expect(res.a).toEqual(res.b);
      expect(res.a).toEqual(res.server);
    }
    expect(ab.a).toEqual(ba.a);
    const p1 = ab.a.plans.find((p) => p.id === 'p1');
    expect(p1?.slots).toEqual(['05:00']); // B's later edit wins the whole record
    expect(p1?.log['2026-10-20']).toBe(5); // max, never 3 + 5 or 3
    expect(ab.a.relatives.map((r) => [r.id, r.history])).toEqual([['r1', ['2026-10-21']]]);
    expect(ab.a.settings.hijriOffset).toBe(-1);
    expect(ab.a.tombstones).toEqual([{ kind: 'relative', id: 'r2', deletedAt: at(4) }]);
  });

  it('a newer edit restores a deleted plan with every log, on every device', () => {
    clock = Date.parse('2026-10-28T11:00:00.000Z');
    const server = new FakeServer();
    let a = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    a = server.sync(updatePlan(a, 'p1', (p) => logDone(p, '2026-10-01', 2), at(1)));
    let b = server.sync(emptyStore());
    a = server.sync(deletePlan(a, 'p1', at(2)));
    expect(server.state.plans).toEqual([]);
    b = updatePlan(b, 'p1', (p) => logDone(p, '2026-10-02', 4), at(3));
    b = server.sync(updatePlan(b, 'p1', (p) => ({ ...p, title: 'أعدتها' }), at(3)));
    a = server.sync(a);
    expect(a.plans[0]?.title).toBe('أعدتها');
    expect(a.plans[0]?.log).toEqual({ '2026-10-01': 2, '2026-10-02': 4 });
    expect(data(a)).toEqual(data(b));
  });

  it('an undo done with the relative-level helper (no tombstone) still reaches the server', () => {
    clock = Date.parse('2026-10-28T10:00:00.000Z');
    const server = new FakeServer();
    let a = upsertRelative(emptyStore(), createRelative({ id: 'r1', name: 'خالتي', relation: '', rule: { kind: 'weekdays', days: [5] } }, at(1)), at(1));
    a = updateRelative(a, 'r1', (x) => logContact(x, '2026-10-10'), at(1));
    a = server.sync(a);
    a = { ...a, relatives: a.relatives.map((x) => undoLastContact(x)) };
    expect(localChanges(a).contacts).toEqual([{ relativeId: 'r1', date: '2026-10-10', deleted: true }]);
    a = server.sync(a);
    expect(server.state.relatives[0]?.history).toEqual([]);
    let b = server.sync(emptyStore());
    b = updateRelative(b, 'r1', (x) => logContact(x, '2026-10-10'), at(2));
    b = server.sync(b);
    a = server.sync(a);
    expect(a.relatives[0]?.history).toEqual(['2026-10-10']);
  });
});

describe('log corrections (undo of «تمّ», a fixed amount)', () => {
  it('a correction wins over the larger amount on every device, and is sent with correctedAt', () => {
    clock = Date.parse('2026-10-28T12:00:00.000Z');
    const server = new FakeServer();
    let a = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    a = server.sync(updatePlan(a, 'p1', (p) => logDone(p, '2026-10-20', 100), at(1)));
    let b = server.sync(emptyStore());
    expect(b.plans[0]?.log['2026-10-20']).toBe(100);

    a = updatePlan(a, 'p1', (p) => correctLog(p, '2026-10-20', 10, at(2)), at(2));
    expect(localChanges(a).logs).toEqual([{ planId: 'p1', date: '2026-10-20', amount: 10, correctedAt: at(2) }]);
    a = server.sync(a);
    b = server.sync(b);
    expect(a.plans[0]?.log['2026-10-20']).toBe(10);
    expect(b.plans[0]?.log['2026-10-20']).toBe(10);
    expect(server.state.plans[0]?.log['2026-10-20']).toBe(10);
    expect(countChanges(localChanges(a))).toBe(0);
    expect(countChanges(localChanges(b))).toBe(0);
  });

  it('an undo to 0 clears the day everywhere; a later «تمّ» counts again', () => {
    clock = Date.parse('2026-10-28T13:00:00.000Z');
    const server = new FakeServer();
    let a = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    a = server.sync(updatePlan(a, 'p1', (p) => logDone(p, '2026-10-20', 5), at(1)));
    let b = server.sync(emptyStore());
    a = server.sync(updatePlan(a, 'p1', (p) => correctLog(p, '2026-10-20', 0, at(2)), at(2)));
    b = server.sync(b);
    expect(b.plans[0]?.log['2026-10-20']).toBe(0);
    b = server.sync(updatePlan(b, 'p1', (p) => logDone(p, '2026-10-20', 3), at(3)));
    a = server.sync(a);
    expect(a.plans[0]?.log['2026-10-20']).toBe(3);
    expect(data(a)).toEqual(data(b));
  });

  it('a stale device cannot bring back the amount that was corrected', () => {
    clock = Date.parse('2026-10-28T14:00:00.000Z');
    const server = new FakeServer();
    let a = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    a = server.sync(updatePlan(a, 'p1', (p) => logDone(p, '2026-10-20', 5), at(1)));
    let b = server.sync(emptyStore());
    // B adds more offline (no correction known), then A undoes.
    b = updatePlan(b, 'p1', (p) => logDone(p, '2026-10-20', 2), at(2));
    a = server.sync(updatePlan(a, 'p1', (p) => correctLog(p, '2026-10-20', 0, at(3)), at(3)));
    b = server.sync(b);
    a = server.sync(a);
    expect(a.plans[0]?.log['2026-10-20']).toBe(0);
    expect(data(a)).toEqual(data(b));
  });

  it('plain logging after the same correction still merges by max', () => {
    clock = Date.parse('2026-10-28T15:00:00.000Z');
    const server = new FakeServer();
    let a = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    a = server.sync(updatePlan(a, 'p1', (p) => correctLog(p, '2026-10-20', 2, at(1)), at(1)));
    let b = server.sync(emptyStore());
    a = updatePlan(a, 'p1', (p) => logDone(p, '2026-10-20', 3), at(2));
    b = updatePlan(b, 'p1', (p) => logDone(p, '2026-10-20', 1), at(2));
    a = server.sync(a);
    b = server.sync(b);
    a = server.sync(a);
    expect(a.plans[0]?.log['2026-10-20']).toBe(5);
    expect(data(a)).toEqual(data(b));
  });

  it('a deleted plan keeps its corrections, and restoring it brings them back', () => {
    clock = Date.parse('2026-10-28T16:00:00.000Z');
    let s = upsertPlan(emptyStore(), plan('p1', at(1)), at(1));
    s = updatePlan(s, 'p1', (p) => correctLog(logDone(p, '2026-10-20', 9), '2026-10-20', 1, at(2)), at(2));
    s = deletePlan(s, 'p1', at(3));
    expect(s.tombstones[0]).toMatchObject({ log: { '2026-10-20': 1 }, logCorrectedAt: { '2026-10-20': at(2) } });
    const late = applyServerChanges(s, { serverTime: at(4), settings: null, plans: [], logs: [{ planId: 'p1', date: '2026-10-20', amount: 9 }], relatives: [], contacts: [] });
    expect(late.tombstones[0]?.log).toEqual({ '2026-10-20': 1 });
    const back = upsertPlan(late, plan('p1', at(5), 'أعدتها'), at(5));
    expect(back.plans[0]?.log).toEqual({ '2026-10-20': 1 });
    expect(back.plans[0]?.logCorrectedAt).toEqual({ '2026-10-20': at(2) });
  });
});
