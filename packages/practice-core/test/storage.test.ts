import { describe, expect, it } from 'vitest';
import {
  checkIn,
  correctLog,
  createPlan,
  createRelative,
  deletePlan,
  deleteRelative,
  emptyStore,
  exportForSync,
  increase,
  logContact,
  logDone,
  parseStore,
  serializeStore,
  startProgram,
  undoContact,
  undoLastContact,
  updatePlan,
  updateRelative,
  updateSettings,
  upsertPlan,
  upsertRelative,
  type Store,
} from '../src/index.js';

const T0 = '2026-10-28T10:00:00.000Z';
const T1 = '2026-10-28T11:00:00.000Z';
const T2 = '2026-10-28T12:00:00.000Z';

function sampleStore(): Store {
  const plan = logDone(
    createPlan(
      {
        id: 'p1',
        deedSlug: 'duha',
        title: 'ركعتا الضحى',
        unit: 'times',
        amount: 1,
        activeDaysPerWeek: 3,
        slots: ['09:00', '11:00'],
        createdOn: '2026-10-01',
      },
      T0,
    ),
    '2026-10-02',
    1,
  );
  const relative = createRelative({ id: 'r1', name: 'خالتي', relation: 'خالة', rule: { kind: 'weekdays', days: [5] } }, T0);
  const program = checkIn(
    startProgram({ sinSlug: 'secret-sin-slug', category: 'haqq_allah', hardToLeaveAtOnce: true, startedOn: '2026-10-01' }),
    '2026-10-02',
    'held',
    'ملاحظة خاصة جدًا',
  );
  return {
    ...emptyStore(),
    plans: [plan],
    relatives: [relative],
    programs: [program],
    settings: { hijriOffset: -1, reminderTimes: ['08:00'], updatedAt: T0 },
  };
}

/** A v1 store as written by the first release. */
function v1Store() {
  const s = sampleStore();
  const strip = <T extends { updatedAt?: string }>(x: T) => {
    const { updatedAt: _, ...rest } = x;
    return rest;
  };
  return {
    v: 1,
    plans: s.plans.map(strip),
    relatives: s.relatives.map((r) => strip(logContact(r, '2026-10-20'))),
    programs: s.programs,
    settings: { hijriOffset: -1, reminderTimes: ['08:00'] },
  };
}

describe('parseStore', () => {
  it('never throws on garbage', () => {
    for (const bad of [undefined, null, 42, 'not json', '{"v":2', [], { v: 3, plans: [] }, { plans: [] }]) {
      expect(parseStore(bad)).toEqual(emptyStore());
    }
  });

  it('round-trips through serializeStore (string input)', () => {
    const store = sampleStore();
    expect(parseStore(serializeStore(store))).toEqual(store);
  });

  it('keeps corrected days (also a cleared one) through a round trip, on plans and on plan tombstones', () => {
    const base = sampleStore();
    const id = base.plans[0]!.id;
    const fixed = updatePlan(base, id, (p) => correctLog(logDone(p, '2026-10-02', 4), '2026-10-02', 0, T2), T2);
    expect(parseStore(serializeStore(fixed))).toEqual(fixed);
    const gone = deletePlan(fixed, id, T2);
    const back = parseStore(serializeStore(gone));
    expect(back.tombstones.find((t) => t.id === id)?.logCorrectedAt).toEqual({ '2026-10-02': T2 });
    expect(back.tombstones.find((t) => t.id === id)?.log?.['2026-10-02']).toBe(0);
  });

  it('upgrades v1 to v2 losslessly, stamping updatedAt with the upgrade time', () => {
    const v1 = v1Store();
    const up = parseStore(JSON.stringify(v1), T2);
    expect(up.v).toBe(2);
    expect(up.plans).toEqual(v1.plans.map((p) => ({ ...p, updatedAt: T2 })));
    expect(up.relatives).toEqual(v1.relatives.map((r) => ({ ...r, updatedAt: T2 })));
    expect(up.programs).toEqual(v1.programs);
    expect(up.settings).toEqual({ hijriOffset: -1, reminderTimes: ['08:00'], updatedAt: T2 });
    expect(up.tombstones).toEqual([]);
    expect(up.sync).toEqual({ lastSyncedAt: null, acked: {} });
  });

  it('does not version default v1 settings (a synced version must win over them)', () => {
    expect(parseStore({ v: 1, settings: { hijriOffset: 0 } }, T2).settings).toEqual({ hijriOffset: 0 });
  });

  it('drops invalid entries one by one and keeps the rest', () => {
    const store = sampleStore();
    const raw = {
      ...store,
      plans: [store.plans[0], { id: 'bad', amount: -1 }, { ...store.plans[0] }, { ...store.plans[0], id: 'p2', updatedAt: 'yesterday' }],
      relatives: [store.relatives[0], { ...store.relatives[0], id: 'r2', name: 'خالتي 0791234567' }, 'x'],
      programs: [
        { ...store.programs[0], checkIns: [...(store.programs[0]?.checkIns ?? []), { date: 'bad', value: 'held' }] },
        { sinSlug: 'ghiba', category: 'haqq_ibad', path: 'gradual', startedOn: '2026-10-01', checkIns: [] },
      ],
      settings: { hijriOffset: 5, reminderTimes: ['08:00', '25:00'], freeMinutesPerDay: 9999 },
      tombstones: [{ kind: 'plan', id: 'x', deletedAt: T1 }, { kind: 'plan', id: 'y' }, { kind: 'contact', id: 'nodate', deletedAt: T1 }],
      sync: { lastSyncedAt: 'never', acked: { 'plan:p1': 'L|1|a', bad: 3 } },
    };
    const parsed = parseStore(raw, T2);
    expect(parsed.plans.map((p) => p.id)).toEqual(['p1']);
    expect(parsed.relatives.map((r) => r.id)).toEqual(['r1']);
    expect(parsed.programs.map((p) => p.sinSlug)).toEqual(['secret-sin-slug']);
    expect(parsed.programs[0]?.checkIns).toHaveLength(1);
    expect(parsed.settings).toEqual({ hijriOffset: 0, reminderTimes: ['08:00'] });
    expect(parsed.tombstones).toEqual([{ kind: 'plan', id: 'x', deletedAt: T1 }]);
    expect(parsed.sync).toEqual({ lastSyncedAt: null, acked: { 'plan:p1': 'L|1|a' } });
  });

  it('keeps the newer of a live entity and its tombstone', () => {
    const store = sampleStore(); // p1 updatedAt T0
    expect(parseStore({ ...store, tombstones: [{ kind: 'plan', id: 'p1', deletedAt: T1 }] }).plans).toEqual([]);
    const edited = parseStore({ ...store, plans: [{ ...store.plans[0], updatedAt: T2 }], tombstones: [{ kind: 'plan', id: 'p1', deletedAt: T1 }] });
    expect(edited.plans.map((p) => p.id)).toEqual(['p1']);
    expect(edited.tombstones).toEqual([]);
  });

  it('copies only known fields', () => {
    const store = sampleStore();
    const parsed = parseStore({ ...store, extra: 1, plans: [{ ...store.plans[0], leak: 'x' }] });
    expect('extra' in parsed).toBe(false);
    expect('leak' in (parsed.plans[0] ?? {})).toBe(false);
  });
});

describe('exportForSync', () => {
  it('excludes sin programs entirely', () => {
    const payload = exportForSync(sampleStore());
    expect('programs' in payload).toBe(false);
    const text = JSON.stringify(payload);
    expect(text).not.toContain('secret-sin-slug');
    expect(text).not.toContain('ملاحظة خاصة');
    expect(Object.keys(payload).sort()).toEqual(['plans', 'relatives', 'settings', 'tombstones', 'v']);
  });

  it('serializeStore keeps programs on the device', () => {
    expect(serializeStore(sampleStore())).toContain('secret-sin-slug');
  });
});

describe('store edits', () => {
  it('entity helpers stamp updatedAt with now', () => {
    const p = sampleStore().plans[0]!;
    expect(p.updatedAt).toBe(T0);
    const withLog = withDaysLogged(p);
    expect(increase(withLog, '2026-11-01', T1).updatedAt).toBe(T1);
    expect(logDone(p, '2026-10-03', 1).updatedAt).toBe(T0); // logs sync on their own
  });

  it('upsertPlan stamps field changes, not log changes, and clears a tombstone', () => {
    let s = sampleStore();
    s = updatePlan(s, 'p1', (p) => logDone(p, '2026-10-05', 1), T1);
    expect(s.plans[0]?.updatedAt).toBe(T0);
    s = updatePlan(s, 'p1', (p) => ({ ...p, title: 'الضحى' }), T1);
    expect(s.plans[0]?.updatedAt).toBe(T1);
    s = deletePlan(s, 'p1', T2);
    expect(s.plans).toEqual([]);
    // The tombstone keeps the log: a newer edit from another device that restores the plan restores it too.
    expect(s.tombstones).toEqual([{ kind: 'plan', id: 'p1', deletedAt: T2, log: { '2026-10-02': 1, '2026-10-05': 1 } }]);
    const again = upsertPlan(s, { ...sampleStore().plans[0]!, updatedAt: undefined }, '2026-10-29T00:00:00.000Z');
    expect(again.tombstones).toEqual([]);
    expect(again.plans[0]?.log).toEqual({ '2026-10-02': 1, '2026-10-05': 1 });
    expect(() => updatePlan(s, 'nope', (p) => p)).toThrow(RangeError);
    expect(() => upsertPlan(s, { ...sampleStore().plans[0]!, amount: -1 })).toThrow(RangeError);
  });

  it('undoContact writes a contact tombstone; logging it again clears it', () => {
    let s = sampleStore();
    s = updateRelative(s, 'r1', (r) => logContact(r, '2026-10-20'), T1);
    expect(s.relatives[0]?.updatedAt).toBe(T0); // contacts do not version the relative
    expect(s.relatives[0]?.lastContactedOn).toBe('2026-10-20');
    s = undoContact(s, 'r1', T2);
    expect(s.relatives[0]?.history).toEqual([]);
    expect('lastContactedOn' in (s.relatives[0] ?? {})).toBe(false);
    expect(s.tombstones).toEqual([{ kind: 'contact', id: 'r1|2026-10-20', deletedAt: T2 }]);
    s = updateRelative(s, 'r1', (r) => logContact(r, '2026-10-20'), T2);
    expect(s.tombstones).toEqual([]);
    // The relative-level helper through updateRelative records the same tombstone.
    s = updateRelative(s, 'r1', undoLastContact, T2);
    expect(s.tombstones).toHaveLength(1);
  });

  it('relative edits stamp updatedAt; deleteRelative writes a tombstone', () => {
    let s = sampleStore();
    s = updateRelative(s, 'r1', (r) => ({ ...r, name: 'خالتي أم علي' }), T1);
    expect(s.relatives[0]?.updatedAt).toBe(T1);
    expect(() => upsertRelative(s, { ...s.relatives[0]!, name: 'a@b.com' })).toThrow(RangeError);
    s = deleteRelative(s, 'r1', T2);
    expect(s.relatives).toEqual([]);
    expect(s.tombstones).toEqual([{ kind: 'relative', id: 'r1', deletedAt: T2 }]);
  });

  it('updateSettings validates and stamps', () => {
    const s = updateSettings(emptyStore(), { hijriOffset: 1, freeMinutesPerDay: 120 }, T1);
    expect(s.settings).toEqual({ hijriOffset: 1, freeMinutesPerDay: 120, updatedAt: T1 });
    expect(() => updateSettings(emptyStore(), { hijriOffset: 3 })).toThrow(RangeError);
    expect(() => updateSettings(emptyStore(), { reminderTimes: ['8am'] })).toThrow(RangeError);
  });
});

function withDaysLogged(p: Store['plans'][number]) {
  let out = { ...p, amountChangedOn: '2026-10-01' };
  for (let d = 1; d <= 31; d++) out = logDone(out, `2026-10-${String(d).padStart(2, '0')}`, 1);
  return out;
}
