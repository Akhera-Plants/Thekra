import { afterEach, describe, expect, it } from 'vitest';
import { startProgram, updateSettings } from '@thekra/practice-core';
import {
  PENDING_PROGRAM_KEY,
  STORE_KEY,
  getPracticeSnapshot,
  parsePrefs,
  resetPracticeSnapshotForTests,
  setPendingProgram,
  takePendingProgram,
  updatePrefs,
  updateStore,
  wipeSinPrograms,
} from './local-store';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function installWindow(storage: unknown): void {
  (globalThis as { window?: unknown }).window = {
    get localStorage() {
      if (storage === 'throw') throw new Error('SecurityError');
      return storage;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  resetPracticeSnapshotForTests();
});

describe('practice local store', () => {
  it('saves through practice-core and reads it back', () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    updateStore((store) => updateSettings(store, { hijriOffset: -1 }));
    expect(JSON.parse(storage.getItem(STORE_KEY) ?? '{}').settings.hijriOffset).toBe(-1);
    resetPracticeSnapshotForTests();
    expect(getPracticeSnapshot()).toMatchObject({ persistent: true, store: { settings: { hijriOffset: -1 } } });
  });

  it('keeps working in memory when storage throws', () => {
    installWindow('throw');
    expect(getPracticeSnapshot().persistent).toBe(false);
    updatePrefs(() => ({ kinshipNamesInCalendar: true }));
    expect(getPracticeSnapshot().prefs.kinshipNamesInCalendar).toBe(true);
  });

  it('wipes every sin program and the pending hand-off at once', () => {
    const storage = new MemoryStorage();
    installWindow(storage);
    setPendingProgram('ghibah');
    updateStore((store) => ({
      ...store,
      programs: [startProgram({ sinSlug: 'ghibah', category: 'haqq_ibad', hardToLeaveAtOnce: false, startedOn: '2026-10-28' })],
    }));
    expect(storage.getItem(STORE_KEY)).toContain('ghibah');
    wipeSinPrograms();
    expect(storage.getItem(STORE_KEY)).not.toContain('ghibah');
    expect(storage.getItem(PENDING_PROGRAM_KEY)).toBeNull();
    expect(getPracticeSnapshot().store.programs).toEqual([]);
  });

  it('hands the pending program over once', () => {
    installWindow(new MemoryStorage());
    setPendingProgram('ghadab');
    expect(takePendingProgram()).toBe('ghadab');
    expect(takePendingProgram()).toBeNull();
  });

  it('drops unknown or invalid preference fields and hands over the old free-minutes value', () => {
    expect(parsePrefs('{"freeMinutesPerDay":-5,"kinshipNamesInCalendar":"yes","x":1}')).toEqual({ prefs: {} });
    expect(parsePrefs('not json')).toEqual({ prefs: {} });
    expect(parsePrefs('{"freeMinutesPerDay":180,"kinshipNamesInCalendar":true,"syncedUserId":"u1"}')).toEqual({
      prefs: { kinshipNamesInCalendar: true, syncedUserId: 'u1' },
      legacyFreeMinutes: 180,
    });
  });

  it('upgrades a v1 device copy: v2 store, UUID plan ids with the habit key kept, free minutes in settings', () => {
    const storage = new MemoryStorage();
    const v1Plan = {
      id: 'quran-wird',
      deedSlug: 'quran',
      title: 'ورد القرآن',
      unit: 'minutes',
      amount: 5,
      activeDaysPerWeek: 3,
      slots: ['06:00'],
      createdOn: '2026-10-01',
      amountChangedOn: '2026-10-01',
      log: { '2026-10-27': 5 },
    };
    storage.setItem(
      STORE_KEY,
      JSON.stringify({ v: 1, plans: [v1Plan], relatives: [], programs: [], settings: { hijriOffset: 1 } }),
    );
    storage.setItem('thekra.practice.prefs.v1', JSON.stringify({ freeMinutesPerDay: 90 }));
    installWindow(storage);
    const { store, prefs } = getPracticeSnapshot();
    expect(store.v).toBe(2);
    expect(store.plans[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.plans[0]).toMatchObject({ habitKey: 'quran-wird', log: { '2026-10-27': 5 } });
    expect(store.plans[0]?.updatedAt).toBeTruthy();
    expect(store.settings).toMatchObject({ hijriOffset: 1, freeMinutesPerDay: 90 });
    expect(store.settings.updatedAt).toBeTruthy();
    expect(prefs).toEqual({});
    // Saved once, so other tabs and the next load read v2.
    expect(JSON.parse(storage.getItem(STORE_KEY) ?? '{}').v).toBe(2);
    expect(storage.getItem('thekra.practice.prefs.v1')).toBe('{}');
  });
});
