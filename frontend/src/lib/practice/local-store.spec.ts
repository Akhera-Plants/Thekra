import { afterEach, describe, expect, it } from 'vitest';
import { startProgram } from '@thekra/practice-core';
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
    updateStore((store) => ({ ...store, settings: { hijriOffset: -1 } }));
    expect(JSON.parse(storage.getItem(STORE_KEY) ?? '{}').settings.hijriOffset).toBe(-1);
    resetPracticeSnapshotForTests();
    expect(getPracticeSnapshot()).toMatchObject({ persistent: true, store: { settings: { hijriOffset: -1 } } });
  });

  it('keeps working in memory when storage throws', () => {
    installWindow('throw');
    expect(getPracticeSnapshot().persistent).toBe(false);
    updatePrefs(() => ({ freeMinutesPerDay: 120 }));
    expect(getPracticeSnapshot().prefs.freeMinutesPerDay).toBe(120);
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

  it('drops unknown or invalid preference fields', () => {
    expect(parsePrefs('{"freeMinutesPerDay":-5,"kinshipNamesInCalendar":"yes","x":1}')).toEqual({});
    expect(parsePrefs('not json')).toEqual({});
    expect(parsePrefs('{"freeMinutesPerDay":180,"kinshipNamesInCalendar":true}')).toEqual({
      freeMinutesPerDay: 180,
      kinshipNamesInCalendar: true,
    });
  });
});
