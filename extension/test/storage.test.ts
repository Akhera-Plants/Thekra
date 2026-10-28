import { createPlan, emptyStore, logDone, startEbb, startSeason, type Store } from '@thekra/practice-core';
import { describe, expect, it } from 'vitest';
import { decodeState, defaultPrefs, encodeState, parsePrefs, PREFS_KEY, STORE_KEY, type State } from '../src/state.js';

/** chrome.storage.local stores JSON-compatible values; structuredClone stands in for that boundary. */
const throughStorage = (values: Record<string, unknown>) => structuredClone(values);

function sample(): State {
  let duha = createPlan({ id: 'duha', deedSlug: 'nawafil', title: 'صلاة الضحى', unit: 'times', amount: 1, activeDaysPerWeek: 3, slots: ['09:30', '11:00'], createdOn: '2026-10-01' });
  duha = logDone(logDone(duha, '2026-10-27', 1), '2026-10-28', 1);
  let quran = createPlan({ id: 'quran-wird', deedSlug: 'quran', title: 'ورد القرآن', unit: 'minutes', amount: 5, ceiling: 30, activeDaysPerWeek: 4, slots: ['06:00'], createdOn: '2026-09-01' });
  quran = startSeason(startEbb(logDone(quran, '2026-10-28', 2), '2026-10-28'), 7, '2026-11-10');
  const store: Store = { ...emptyStore(), plans: [duha, quran], settings: { hijriOffset: -1 } };
  return {
    store,
    prefs: { v: 1, lang: 'en', quietDays: [5, 6], rules: { duha: { kind: 'daily' }, 'quran-wird': { kind: 'weekdays', days: [0, 1, 2, 3] } }, onboarded: true },
  };
}

describe('storage round-trip', () => {
  it('reads back exactly what it wrote (practice-core serializeStore / parseStore)', () => {
    const state = sample();
    const written = encodeState(state);
    expect(Object.keys(written).sort()).toEqual([PREFS_KEY, STORE_KEY].sort());
    expect(typeof written[STORE_KEY]).toBe('string');
    expect(decodeState(throughStorage(written))).toEqual(state);
  });

  it('is stable: encoding the decoded state gives the same text', () => {
    const once = encodeState(sample());
    expect(encodeState(decodeState(throughStorage(once)))).toEqual(once);
  });

  it('starts empty on first run and on unreadable data, never throwing', () => {
    const fresh = decodeState(undefined);
    expect(fresh).toEqual({ store: emptyStore(), prefs: defaultPrefs() });
    expect(decodeState({ [STORE_KEY]: '{not json', [PREFS_KEY]: '{oops' })).toEqual(fresh);
    expect(decodeState({ [STORE_KEY]: JSON.stringify({ v: 99 }) }).store).toEqual(emptyStore());
  });

  it('drops invalid plans one by one and the rules of plans that are gone', () => {
    const state = sample();
    const raw = JSON.parse(encodeState(state)[STORE_KEY] as string) as { plans: unknown[] };
    raw.plans.push({ id: 'broken', amount: -1 });
    const prefs = { ...state.prefs, rules: { ...state.prefs.rules, ghost: { kind: 'daily' } } };
    const back = decodeState({ [STORE_KEY]: JSON.stringify(raw), [PREFS_KEY]: JSON.stringify(prefs) });
    expect(back.store.plans.map((p) => p.id)).toEqual(['duha', 'quran-wird']);
    expect(Object.keys(back.prefs.rules).sort()).toEqual(['duha', 'quran-wird']);
  });

  it('validates preferences field by field and drops unknown keys', () => {
    const p = parsePrefs({ v: 1, lang: 'fr', quietDays: [5, 5, 9, -1, 1.5, 0], rules: { a: { kind: 'weekdays', days: [8] }, b: { kind: 'daily' } }, onboarded: 'yes', extra: 1 });
    expect(p).toEqual({ v: 1, lang: 'ar', quietDays: [0, 5], rules: { b: { kind: 'daily' } }, onboarded: false });
  });

  it('holds no sin-program data (the extension is for good deeds only)', () => {
    const back = decodeState(throughStorage(encodeState(sample())));
    expect(back.store.programs).toEqual([]);
    expect(encodeState(sample())[STORE_KEY]).not.toMatch(/sinSlug/);
  });
});
