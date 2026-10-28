import {
  applyServerChanges,
  createPlan,
  createRelative,
  deletePlan,
  emptyStore,
  logDone,
  startEbb,
  startSeason,
  updatePlan,
  upsertPlan,
  upsertRelative,
  type Store,
} from '@thekra/practice-core';
import { describe, expect, it } from 'vitest';
import { decodeState, defaultPrefs, encodeState, parsePrefs, PREFS_KEY, STORE_KEY, type State } from '../src/state.js';

/** chrome.storage.local stores JSON-compatible values; structuredClone stands in for that boundary. */
const throughStorage = (values: Record<string, unknown>) => structuredClone(values);
const T0 = '2026-10-28T08:00:00.000Z';
const DUHA = '0d1c7d36-0b8e-4d1a-9a59-6c0b6f0f2a11';
const QURAN = '5a3e4b55-8b0e-4c2b-8f1e-2f7c8a4e9d22';
const REL = '7b2f3c44-1a2b-4c3d-9e8f-0a1b2c3d4e5f';

function sample(): State {
  let store: Store = emptyStore();
  let duha = createPlan({ id: DUHA, habitKey: 'duha', rule: { kind: 'daily' }, deedSlug: 'nawafil', title: 'صلاة الضحى', unit: 'times', amount: 1, activeDaysPerWeek: 3, slots: ['09:30', '11:00'], createdOn: '2026-10-01' }, T0);
  duha = logDone(logDone(duha, '2026-10-27', 1), '2026-10-28', 1);
  let quran = createPlan({ id: QURAN, habitKey: 'quran-wird', rule: { kind: 'weekdays', days: [0, 1, 2, 3] }, deedSlug: 'quran', title: 'ورد القرآن', unit: 'minutes', amount: 5, ceiling: 30, activeDaysPerWeek: 4, slots: ['06:00'], createdOn: '2026-09-01' }, T0);
  quran = startSeason(startEbb(logDone(quran, '2026-10-28', 2), '2026-10-28', T0), 7, '2026-11-10', T0);
  store = upsertPlan(upsertPlan(store, duha, T0), quran, T0);
  return { store: { ...store, settings: { hijriOffset: -1, updatedAt: T0 } }, prefs: { v: 2, lang: 'en', quietDays: [5, 6], onboarded: true } };
}

describe('storage round-trip (Store v2)', () => {
  it('reads back exactly what it wrote (practice-core serializeStore / parseStore)', () => {
    const state = sample();
    const written = encodeState(state);
    expect(Object.keys(written).sort()).toEqual([PREFS_KEY, STORE_KEY].sort());
    const back = decodeState(throughStorage(written));
    expect(back.migrated).toBe(false);
    expect({ store: back.store, prefs: back.prefs }).toEqual(state);
    expect(back.store.v).toBe(2);
  });

  it('is stable: encoding the decoded state gives the same text', () => {
    const once = encodeState(sample());
    expect(encodeState(decodeState(throughStorage(once)))).toEqual(once);
  });

  it('keeps tombstones, sync state, and relatives that came from the account', () => {
    const rel = createRelative({ id: REL, name: 'خالتي', relation: 'خالة', rule: { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-10-30' } }, T0);
    let store = upsertRelative(deletePlan(sample().store, DUHA, T0), rel, T0);
    store = { ...store, sync: { lastSyncedAt: T0, acked: { [`plan:${QURAN}`]: 'x' } } };
    const back = decodeState(throughStorage(encodeState({ store, prefs: defaultPrefs() }))).store;
    expect(back.relatives.map((r) => r.id)).toEqual([REL]);
    expect(back.tombstones.find((t) => t.kind === 'plan')?.id).toBe(DUHA);
    expect(back.sync).toEqual(store.sync);
  });

  it('starts empty on first run and on unreadable data, never throwing', () => {
    const fresh = decodeState(undefined);
    expect({ store: fresh.store, prefs: fresh.prefs }).toEqual({ store: emptyStore(), prefs: defaultPrefs() });
    const bad = decodeState({ [STORE_KEY]: '{not json', [PREFS_KEY]: '{oops' });
    expect(bad.store).toEqual(emptyStore());
    expect(bad.prefs).toEqual(defaultPrefs());
  });

  it('validates preferences field by field and drops unknown keys', () => {
    const p = parsePrefs({ v: 2, lang: 'fr', quietDays: [5, 5, 9, -1, 1.5, 0], onboarded: 'yes', rules: {}, extra: 1 });
    expect(p).toEqual({ v: 2, lang: 'ar', quietDays: [0, 5], onboarded: false });
  });

  it('holds no sin-program data (the extension is for good deeds only)', () => {
    const back = decodeState(throughStorage(encodeState(sample())));
    expect(back.store.programs).toEqual([]);
    expect(encodeState(sample())[STORE_KEY]).not.toMatch(/sinSlug/);
  });
});

describe('upgrade from the first extension version', () => {
  // What version 0.1.0 wrote: Store v1, plan id = habit key, rules in prefs.
  const v1Store = {
    v: 1,
    plans: [
      { id: 'duha', deedSlug: 'nawafil', title: 'صلاة الضحى', unit: 'times', amount: 1, activeDaysPerWeek: 3, slots: ['09:30'], createdOn: '2026-10-01', amountChangedOn: '2026-10-01', log: { '2026-10-27': 1 } },
      { id: 'qiyam-last-third', deedSlug: 'nawafil', title: 'قيام الليل', unit: 'times', amount: 1, activeDaysPerWeek: 2, slots: ['04:00'], createdOn: '2026-10-01', amountChangedOn: '2026-10-01', log: {} },
    ],
    relatives: [],
    programs: [],
    settings: { hijriOffset: 1 },
  };
  const v1Prefs = { v: 1, lang: 'en', quietDays: [5], rules: { duha: { kind: 'daily' }, 'qiyam-last-third': { kind: 'weekdays', days: [5] } }, onboarded: true };

  it('gives plans UUID ids, keeps the habit key, moves the rule into the plan, and keeps logs', () => {
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    const out = decodeState({ [STORE_KEY]: JSON.stringify(v1Store), [PREFS_KEY]: JSON.stringify(v1Prefs) }, { now: T0, newId: () => ids.shift() as string });
    expect(out.migrated).toBe(true);
    expect(out.store.v).toBe(2);
    expect(out.store.plans.map((p) => [p.id, p.habitKey, p.rule])).toEqual([
      ['11111111-1111-4111-8111-111111111111', 'duha', { kind: 'daily' }],
      ['22222222-2222-4222-8222-222222222222', 'qiyam-last-third', { kind: 'weekdays', days: [5] }],
    ]);
    expect(out.store.plans[0]?.log).toEqual({ '2026-10-27': 1 });
    expect(out.store.plans[0]?.updatedAt).toBe(T0);
    expect(out.store.settings).toEqual({ hijriOffset: 1, updatedAt: T0 });
    expect(out.store.tombstones).toEqual([]);
    expect(out.prefs).toEqual({ v: 2, lang: 'en', quietDays: [5], onboarded: true });
    // Written back, it reads as already migrated.
    const again = decodeState(encodeState(out));
    expect(again.migrated).toBe(false);
    expect(again.store.plans.map((p) => p.id)).toEqual(out.store.plans.map((p) => p.id));
  });
});

describe('store helpers keep versions right', () => {
  it('a log keeps the plan version; a plan edit stamps a new one', () => {
    const store = sample().store;
    const logged = updatePlan(store, DUHA, (p) => logDone(p, '2026-10-29', 1), '2026-10-29T10:00:00.000Z');
    expect(logged.plans.find((p) => p.id === DUHA)?.updatedAt).toBe(T0);
    const edited = updatePlan(store, DUHA, (p) => ({ ...p, slots: ['10:00'] }), '2026-10-29T10:00:00.000Z');
    expect(edited.plans.find((p) => p.id === DUHA)?.updatedAt).toBe('2026-10-29T10:00:00.000Z');
  });

  it('server changes merge into the store and relatives stay', () => {
    const merged = applyServerChanges(sample().store, {
      data: {
        serverTime: '2026-10-28T09:00:00.000Z',
        settings: null,
        plans: [],
        logs: [{ planId: DUHA, date: '2026-10-28', amount: 3 }],
        relatives: [{ id: REL, name: 'خالتي', relation: 'خالة', rule: { kind: 'weekdays', days: [5] }, lastContactedOn: null, clientUpdatedAt: T0, deletedAt: null }],
        contacts: [],
      },
    });
    expect(merged.plans.find((p) => p.id === DUHA)?.log['2026-10-28']).toBe(3);
    const back = decodeState(throughStorage(encodeState({ store: merged, prefs: defaultPrefs() }))).store;
    expect(back.relatives.map((r) => r.name)).toEqual(['خالتي']);
    expect(back.sync.lastSyncedAt).toBe('2026-10-28T09:00:00.000Z');
  });
});
