/**
 * Account sync payload and merge (pure parts of src/lib/practice/sync.ts).
 * The sin program must never be part of anything sent to the server (roadmap §0.1).
 */

import {
  checkIn,
  createPlan,
  createRelative,
  emptyStore,
  exportForSync,
  logContact,
  logDone,
  startProgram,
  type Store,
} from '@thekra/practice-core';
import {
  applySyncPayload,
  buildSyncBody,
  conflictFromDetails,
  decideSync,
  mergeSyncPayloads,
  payloadJson,
} from '../lib/practice/sync';

function store(): Store {
  const plan = logDone(
    createPlan({
      id: 'quran-wird',
      deedSlug: 'quran',
      title: 'ورد القرآن',
      unit: 'minutes',
      amount: 5,
      activeDaysPerWeek: 3,
      slots: ['06:00', '21:00'],
      createdOn: '2026-10-01',
    }),
    '2026-10-27',
    5,
  );
  const rel = createRelative({ id: 'r1', name: 'خالتي', relation: 'خالة', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } });
  let program = startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-20' });
  program = checkIn(program, '2026-10-27', 'fell_repented', 'سرّ لا يعرفه أحد');
  return { v: 1, plans: [plan], relatives: [rel], programs: [program], settings: { hijriOffset: 1 } };
}

describe('sync payload', () => {
  it('has no programs key and carries nothing from the sin program', () => {
    const body = buildSyncBody(store(), 3);
    expect(body.version).toBe(3);
    expect(Object.keys(body.store).sort()).toEqual(['plans', 'relatives', 'settings', 'v']);
    expect(body.store).not.toHaveProperty('programs');
    const json = JSON.stringify(body);
    expect(json).not.toContain('programs');
    expect(json).not.toContain('ghibah');
    expect(json).not.toContain('سرّ');
    expect(json).not.toContain('fell_repented');
  });

  it('a stray programs field on the input never rides along', () => {
    const s = store() as Store & { extra?: unknown };
    (s as unknown as Record<string, unknown>).extra = { programs: s.programs };
    const body = buildSyncBody(s, 0);
    expect(JSON.stringify(body)).not.toContain('ghibah');
  });

  it('pulling a server payload keeps the local sin program untouched', () => {
    const local = store();
    const remote = { ...exportForSync(emptyStore()), settings: { hijriOffset: -1 } };
    const next = applySyncPayload(local, remote);
    expect(next.plans).toEqual([]);
    expect(next.settings.hijriOffset).toBe(-1);
    expect(next.programs).toEqual(local.programs);
  });
});

describe('merge and decision', () => {
  it('merges plans by id, keeping the larger amount per day, and relative histories as a union', () => {
    const local = exportForSync(store());
    const remoteStore = store();
    remoteStore.plans[0] = logDone({ ...remoteStore.plans[0]!, log: { '2026-10-26': 3 } }, '2026-10-27', 2);
    remoteStore.relatives[0] = logContact(remoteStore.relatives[0]!, '2026-10-25');
    const merged = mergeSyncPayloads(local, exportForSync(remoteStore));
    expect(merged.plans).toHaveLength(1);
    expect(merged.plans[0]!.log).toEqual({ '2026-10-26': 3, '2026-10-27': 5 });
    expect(merged.relatives[0]!.history).toEqual(['2026-10-25']);
    expect(merged.relatives[0]!.lastContactedOn).toBe('2026-10-25');
    expect(merged).not.toHaveProperty('programs');
  });

  it('decides push / pull / merge from the last synced version', () => {
    const local = exportForSync(store());
    const json = payloadJson(local);
    const meta = { userId: 'u1', version: 4, payloadJson: json };
    expect(decideSync({ local, remote: { store: local, version: 4 }, meta, userId: 'u1' }).action).toBe('noop');
    expect(decideSync({ local, remote: { store: { ...local, plans: [] }, version: 5 }, meta, userId: 'u1' }).action).toBe('pull');
    const changed = { ...local, settings: { hijriOffset: 2 } };
    expect(decideSync({ local: changed, remote: { store: local, version: 4 }, meta, userId: 'u1' }).action).toBe('push');
    expect(decideSync({ local: changed, remote: { store: local, version: 5 }, meta, userId: 'u1' }).action).toBe('merge-push');
    // Another account, or never synced: merge with what the server has.
    expect(decideSync({ local, remote: { store: null, version: 0 }, meta: null, userId: 'u2' }).action).toBe('push');
    // A server without a store never empties the device.
    expect(decideSync({ local, remote: { store: null, version: 9 }, meta, userId: 'u1' }).action).toBe('push');
  });

  it('reads the current store and version from a 409 conflict', () => {
    const payload = exportForSync(store());
    expect(conflictFromDetails({ store: payload, version: 7 })).toEqual({ store: payload, version: 7 });
    expect(conflictFromDetails({ current: { store: null, version: 2 } })).toEqual({ store: null, version: 2 });
    expect(conflictFromDetails(null)).toBeNull();
    // A program smuggled into the conflict store is dropped.
    const withPrograms = { ...store() };
    expect(JSON.stringify(conflictFromDetails({ store: withPrograms, version: 1 }))).not.toContain('ghibah');
  });
});
