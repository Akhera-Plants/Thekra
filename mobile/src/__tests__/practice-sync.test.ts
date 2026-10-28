/**
 * Account sync body (practice-core `buildSyncRequest`, contract §3) and the one-time migration of data written
 * by the first app version. The sin program (slug, check-ins, notes) must never be in a sync body.
 */

import {
  applyServerChanges,
  buildSyncRequest,
  checkIn,
  createPlan,
  createRelative,
  deletePlan,
  emptyStore,
  logDone,
  parseStore,
  startProgram,
  updatePlan,
  updateSettings,
  upsertPlan,
  upsertRelative,
  type Store,
} from '@thekra/practice-core';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('../lib/api/practice', () => ({ getPracticeChanges: jest.fn(), postPracticeSync: jest.fn() }));

import { migrateLegacy } from '../lib/practice/practice-store';
import { assertNoPrograms } from '../lib/practice/sync-runner';

const NOW = '2026-10-28T10:00:00.000Z';
const PLAN_ID = '7b0c1d9e-3f43-4a7e-9c55-0d6f1b2a3c4d';
const REL_ID = '0f6e8c1a-2b3d-4e5f-8a9b-1c2d3e4f5a6b';

function store(): Store {
  let s = emptyStore();
  s = upsertPlan(
    s,
    createPlan(
      {
        id: PLAN_ID,
        habitKey: 'quran-wird',
        deedSlug: 'quran',
        title: 'ورد القرآن',
        unit: 'minutes',
        amount: 5,
        activeDaysPerWeek: 3,
        slots: ['06:00', '21:00'],
        createdOn: '2026-10-01',
      },
      NOW,
    ),
    NOW,
  );
  s = updatePlan(s, PLAN_ID, (p) => logDone(p, '2026-10-27', 5), NOW);
  s = upsertRelative(s, createRelative({ id: REL_ID, name: 'خالتي', relation: 'خالة', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' } }, NOW), NOW);
  s = updateSettings(s, { hijriOffset: 1, freeMinutesPerDay: 120 }, NOW);
  let program = startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-20' });
  program = checkIn(program, '2026-10-27', 'fell_repented', 'سرّ لا يعرفه أحد');
  return { ...s, programs: [program] };
}

function expectNoSinData(body: unknown) {
  const json = JSON.stringify(body);
  expect(json).not.toContain('programs');
  expect(json).not.toContain('ghibah');
  expect(json).not.toContain('سرّ');
  expect(json).not.toContain('fell_repented');
  expect(json).not.toContain('checkIns');
  expect(() => assertNoPrograms(body)).not.toThrow();
}

describe('sync body', () => {
  it('carries plans, logs, relatives and settings, and nothing from the sin program', () => {
    const body = buildSyncRequest(store());
    expect(body.since).toBeNull();
    expect(body.changes.plans).toHaveLength(1);
    expect(body.changes.plans[0]).toMatchObject({ id: PLAN_ID, habitKey: 'quran-wird', amount: 5, deletedAt: null });
    expect(body.changes.logs).toEqual([{ planId: PLAN_ID, date: '2026-10-27', amount: 5 }]);
    expect(body.changes.relatives[0]).toMatchObject({ id: REL_ID, name: 'خالتي' });
    expect(body.changes.settings).toMatchObject({ hijriOffset: 1, freeMinutesPerDay: 120 });
    expectNoSinData(body);
  });

  it('a deleted plan goes out as { id, clientUpdatedAt, deletedAt } only', () => {
    const body = buildSyncRequest(deletePlan(store(), PLAN_ID, '2026-10-28T11:00:00.000Z'));
    expect(body.changes.plans).toEqual([
      { id: PLAN_ID, clientUpdatedAt: '2026-10-28T11:00:00.000Z', deletedAt: '2026-10-28T11:00:00.000Z' },
    ]);
    expectNoSinData(body);
  });

  it('nothing pending after the server acknowledges, programs untouched', () => {
    const s = store();
    const body = buildSyncRequest(s);
    const response = {
      serverTime: '2026-10-28T12:00:00.000Z',
      settings: { ...body.changes.settings! },
      plans: body.changes.plans,
      logs: body.changes.logs,
      relatives: body.changes.relatives,
      contacts: body.changes.contacts,
    };
    const after = applyServerChanges(s, response);
    expect(after.sync.lastSyncedAt).toBe('2026-10-28T12:00:00.000Z');
    expect(after.programs).toEqual(s.programs);
    const next = buildSyncRequest(after);
    expect(next.since).toBe('2026-10-28T12:00:00.000Z');
    expect(next.changes).toEqual({ plans: [], logs: [], relatives: [], contacts: [] });
  });

  it('assertNoPrograms stops a body with a programs key anywhere', () => {
    expect(() => assertNoPrograms({ changes: { plans: [], extra: { programs: [] } } })).toThrow();
  });
});

describe('migration of the first app version', () => {
  it('upgrades a { v: 1 } store, gives plans/relatives UUID ids, moves rule and free minutes into the store', () => {
    const v1 = {
      v: 1,
      plans: [
        {
          id: 'duha',
          deedSlug: 'nawafil',
          title: 'صلاة الضحى',
          unit: 'times',
          amount: 1,
          activeDaysPerWeek: 3,
          slots: ['09:30'],
          createdOn: '2026-10-01',
          amountChangedOn: '2026-10-01',
          log: { '2026-10-27': 1 },
        },
      ],
      relatives: [{ id: 'rel-abc-123', name: 'خالتي', relation: '', rule: { kind: 'everyNDays', n: 7, anchor: '2026-10-01' }, history: [] }],
      programs: [],
      settings: { hijriOffset: 0 },
    };
    const prefs = JSON.stringify({ v: 1, planRules: { duha: { kind: 'weekdays', days: [5] } }, freeMinutesPerDay: 90 });
    let n = 0;
    const ids = [PLAN_ID, REL_ID];
    const { store: s, changed } = migrateLegacy(parseStore(v1, NOW), prefs, () => ids[n++] as string);
    expect(changed).toBe(true);
    expect(s.v).toBe(2);
    expect(s.plans[0]).toMatchObject({ id: PLAN_ID, habitKey: 'duha', rule: { kind: 'weekdays', days: [5] }, log: { '2026-10-27': 1 } });
    expect(s.relatives[0]?.id).toBe(REL_ID);
    expect(s.settings.freeMinutesPerDay).toBe(90);
    expect(s.tombstones).toEqual([]); // the old ids were never synced: no tombstone for them
    const body = buildSyncRequest(s);
    expect(body.changes.plans.map((p) => p.id)).toEqual([PLAN_ID]); // the habit key is never sent as an id
    expect(JSON.stringify(body)).not.toContain('rel-abc-123');
  });
});
