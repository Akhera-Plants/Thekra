/**
 * The real client against the real server: two simulated devices of one user drive @thekra/practice-core
 * exactly as the web app, the extension and the mobile app do (store mutators → buildSyncRequest →
 * POST /v1/me/practice/sync → applyServerChanges, until countChanges is 0), and must end with identical
 * synced state. Also the encrypted sin vault round trip. No request body may carry `programs` or a sin slug.
 */

import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  applyServerChanges,
  buildSyncRequest,
  countChanges,
  createPlan,
  createRelative,
  deletePlan,
  deriveKey,
  emptyStore,
  localChanges,
  logContact,
  logDone,
  newSalt,
  planFields,
  relativeFields,
  sealPrograms,
  startProgram,
  undoContact,
  unlockVault,
  updatePlan,
  updateRelative,
  updateSettings,
  upsertPlan,
  upsertRelative,
  vaultPayload,
  VaultLockedError,
  type Store,
} from '@thekra/practice-core';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

/** A sin slug that must never appear in a request body (it lives only inside the sealed vault). */
const SIN_SLUG = 'ghibah';
const at = (second: number) => new Date(Date.UTC(2026, 9, 28, 10, 0, 0) + second * 1000).toISOString();

interface Device {
  name: string;
  store: Store;
}

/** The parts of a store that sync: settings, plans with logs, relatives with contacts, deletions. */
function synced(store: Store) {
  const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  const s = store.settings;
  return {
    settings: { hijriOffset: s.hijriOffset, reminderTimes: s.reminderTimes ?? [], freeMinutesPerDay: s.freeMinutesPerDay ?? null, updatedAt: s.updatedAt },
    plans: byId(store.plans).map((p) => ({
      id: p.id,
      ...planFields(p),
      updatedAt: p.updatedAt,
      log: Object.fromEntries(Object.entries(p.log).sort(([a], [b]) => a.localeCompare(b))),
    })),
    relatives: byId(store.relatives).map((r) => ({ id: r.id, ...relativeFields(r), updatedAt: r.updatedAt, history: [...r.history].sort() })),
    deletedPlans: store.tombstones.filter((t) => t.kind === 'plan').map((t) => t.id).sort(),
    deletedRelatives: store.tombstones.filter((t) => t.kind === 'relative').map((t) => t.id).sort(),
  };
}

describe('practice-core client ↔ server compatibility (e2e)', () => {
  let app: INestApplication<App>;
  const bodies: string[] = [];
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    let prisma: PrismaService;
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
  });

  afterAll(async () => {
    // Nothing that left a device in clear may name the sin or carry programs.
    expect(bodies.length).toBeGreaterThan(10);
    for (const body of bodies) {
      expect(body).not.toContain('"programs"');
      expect(body).not.toContain(SIN_SLUG);
    }
    await closeTestApp(app);
  });

  async function signUp(): Promise<Record<string, string>> {
    const email = `compat-${randomUUID()}@thekra.test`;
    const res = await request(server()).post('/v1/auth/register').send({ email, password: 'password123456' }).expect(201);
    return { Authorization: `Bearer ${res.body.data.accessToken}` };
  }

  /** One client sync cycle: push local changes, merge the answer, repeat while anything is pending. */
  async function sync(device: Device, auth: Record<string, string>): Promise<number> {
    for (let round = 1; round <= 10; round += 1) {
      const body = buildSyncRequest(device.store);
      const text = JSON.stringify(body);
      bodies.push(text);
      const res = await request(server()).post('/v1/me/practice/sync').set(auth).set('Content-Type', 'application/json').send(text);
      if (res.status !== 200) throw new Error(`${device.name} sync round ${round}: ${res.status} ${JSON.stringify(res.body)}`);
      device.store = applyServerChanges(device.store, res.body);
      if (countChanges(localChanges(device.store)) === 0) return round;
    }
    throw new Error(`${device.name} still has pending changes after 10 rounds`);
  }

  function plan(id: string, title: string, now: string) {
    return createPlan(
      {
        id,
        habitKey: 'duha',
        rule: { kind: 'daily' },
        deedSlug: 'nawafil',
        title,
        unit: 'times',
        amount: 1,
        activeDaysPerWeek: 3,
        slots: ['09:30', '11:00'],
        createdOn: '2026-10-28',
      },
      now,
    );
  }

  it('device B pulls exactly what device A created; concurrent edits converge; deletes follow the rules', async () => {
    const auth = await signUp();
    const a: Device = { name: 'A', store: emptyStore() };
    const b: Device = { name: 'B', store: emptyStore() };
    const [p1, p2, p3] = [randomUUID(), randomUUID(), randomUUID()];
    const [r1, r2] = [randomUUID(), randomUUID()];

    // (1) Device A creates everything; its local sin program must never leave it.
    a.store = { ...a.store, programs: [startProgram({ sinSlug: SIN_SLUG, category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-28' })] };
    a.store = upsertPlan(a.store, plan(p1, 'الضحى', at(1)), at(1));
    a.store = upsertPlan(a.store, { ...plan(p2, 'الوتر', at(2)), unit: 'minutes', amount: 2.5, ceiling: 10 }, at(2));
    a.store = upsertPlan(a.store, plan(p3, 'قيام', at(3)), at(3));
    a.store = updatePlan(a.store, p1, (p) => logDone(logDone(p, '2026-10-27', 1), '2026-10-28', 0.5), at(4));
    a.store = updatePlan(a.store, p2, (p) => logDone(p, '2026-10-28', 2.5), at(4));
    a.store = upsertRelative(a.store, createRelative({ id: r1, name: 'خالتي', relation: 'خالة', rule: { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-10-30' } }, at(5)), at(5));
    a.store = upsertRelative(a.store, createRelative({ id: r2, name: 'جدي', relation: '', rule: { kind: 'everyNDays', n: 3, anchor: '2026-10-28' } }, at(6)), at(6));
    a.store = updateRelative(a.store, r1, (r) => logContact(logContact(r, '2026-10-20'), '2026-10-27'), at(7));
    a.store = updateSettings(a.store, { hijriOffset: 1, reminderTimes: ['07:00', '21:00'], freeMinutesPerDay: 90 }, at(8));
    await sync(a, auth);
    await sync(b, auth);
    expect(synced(b.store)).toEqual(synced(a.store));
    expect(synced(b.store).plans).toHaveLength(3);
    expect(b.store.plans.find((p) => p.id === p1)?.log).toEqual({ '2026-10-27': 1, '2026-10-28': 0.5 });
    expect(b.store.relatives.find((r) => r.id === r1)?.history.sort()).toEqual(['2026-10-20', '2026-10-27']);
    expect(b.store.programs).toEqual([]);

    // (2) Concurrent edits on both devices, then both sync twice.
    a.store = updatePlan(a.store, p1, (p) => ({ ...p, title: 'الضحى (A)' }), at(10));
    b.store = updatePlan(b.store, p1, (p) => ({ ...p, amount: 2 }), at(11)); // later: wins
    a.store = updatePlan(a.store, p3, (p) => logDone(p, '2026-10-29', 1), at(10));
    b.store = updatePlan(b.store, p3, (p) => logDone(p, '2026-10-29', 3), at(10)); // max wins
    a.store = updateSettings(a.store, { hijriOffset: 0 }, at(12));
    b.store = updateSettings(b.store, { hijriOffset: -1 }, at(13)); // later: wins
    a.store = undoContact(a.store, r1, at(14)); // removes 2026-10-27
    b.store = updateRelative(b.store, r1, (r) => logContact(r, '2026-10-28'), at(14));
    a.store = updateRelative(a.store, r2, (r) => ({ ...r, name: 'جدي الحبيب' }), at(15));
    b.store = updateRelative(b.store, r2, (r) => ({ ...r, relation: 'جد' }), at(15)); // same time: larger canonical JSON wins
    for (let i = 0; i < 2; i += 1) {
      await sync(a, auth);
      await sync(b, auth);
    }
    expect(synced(a.store)).toEqual(synced(b.store));
    const p1Now = a.store.plans.find((p) => p.id === p1);
    expect(p1Now).toMatchObject({ title: 'الضحى', amount: 2 });
    expect(a.store.plans.find((p) => p.id === p3)?.log['2026-10-29']).toBe(3);
    expect(a.store.settings.hijriOffset).toBe(-1);
    expect(a.store.relatives.find((r) => r.id === r1)?.history.sort()).toEqual(['2026-10-20', '2026-10-28']);

    // (3) A deletes p2, B edits it later → the edit wins and the logs come back; B edits p3, A deletes it later → deleted.
    a.store = deletePlan(a.store, p2, at(20));
    b.store = updatePlan(b.store, p2, (p) => ({ ...p, title: 'الوتر (B)' }), at(21));
    b.store = updatePlan(b.store, p3, (p) => ({ ...p, title: 'قيام (B)' }), at(22));
    a.store = deletePlan(a.store, p3, at(23));
    for (let i = 0; i < 2; i += 1) {
      await sync(a, auth);
      await sync(b, auth);
    }
    expect(synced(a.store)).toEqual(synced(b.store));
    expect(a.store.plans.find((p) => p.id === p2)).toMatchObject({ title: 'الوتر (B)', log: { '2026-10-28': 2.5 } });
    expect(a.store.plans.some((p) => p.id === p3)).toBe(false);
    expect(synced(a.store).deletedPlans).toEqual([p3]);
  });

  it('a first sync with more than 500 items goes out in batches and arrives whole', async () => {
    const auth = await signUp();
    const a: Device = { name: 'A', store: emptyStore() };
    const ids = Array.from({ length: 40 }, () => randomUUID());
    for (const [index, id] of ids.entries()) {
      a.store = upsertPlan(a.store, plan(id, `خطة ${index}`, at(index)), at(index));
      a.store = updatePlan(a.store, id, (p) => {
        let next = p;
        for (let day = 1; day <= 13; day += 1) next = logDone(next, `2026-10-${String(day).padStart(2, '0')}`, day);
        return next;
      });
    }
    expect(countChanges(localChanges(a.store, { maxItems: 10_000 }))).toBe(40 + 40 * 13);
    const rounds = await sync(a, auth);
    expect(rounds).toBeGreaterThanOrEqual(2);
    const b: Device = { name: 'B', store: emptyStore() };
    await sync(b, auth);
    expect(synced(b.store)).toEqual(synced(a.store));
    expect(b.store.plans.reduce((sum, p) => sum + Object.keys(p.log).length, 0)).toBe(520);
  });

  it('the sin vault round-trips through the server and stays sealed', async () => {
    const auth = await signUp();
    const code = 'رمز خاص 2026';
    const programs = [startProgram({ sinSlug: SIN_SLUG, category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-28' })];
    const salt = newSalt();
    const key = deriveKey(code, salt); // the default 210000 iterations the server requires
    const payload = vaultPayload(sealPrograms(programs, key), { salt, iterations: 210_000, version: 0 });
    const putBody = JSON.stringify(payload);
    bodies.push(putBody);
    const put = await request(server()).put('/v1/me/sin-vault').set(auth).set('Content-Type', 'application/json').send(putBody).expect(200);
    expect(put.body).toEqual({ data: { version: 1 } });

    // Device B reads it and opens it with the code.
    const got = await request(server()).get('/v1/me/sin-vault').set(auth).expect(200);
    const vault = got.body.data.vault;
    expect(vault).toMatchObject({ ciphertext: payload.ciphertext, iv: payload.iv, salt, kdf: 'pbkdf2-sha256', iterations: 210_000, version: 1 });
    expect(unlockVault(vault, code).programs).toEqual(programs);
    expect(() => unlockVault(vault, 'رمز خاطئ')).toThrow(VaultLockedError);

    // A device still on version 0 is refused and handed the current vault.
    const staleBody = JSON.stringify(vaultPayload(sealPrograms([], key), { salt, iterations: 210_000, version: 0 }));
    bodies.push(staleBody);
    const stale = await request(server()).put('/v1/me/sin-vault').set(auth).set('Content-Type', 'application/json').send(staleBody).expect(409);
    expect(stale.body.error.code).toBe('SIN_VAULT_CONFLICT');
    expect(stale.body.error.details.vault).toEqual(vault);
    expect(unlockVault(stale.body.error.details.vault, code).programs).toEqual(programs);
  });
});
