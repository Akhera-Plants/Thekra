import { describe, expect, it } from 'vitest';
import {
  checkIn,
  createPlan,
  createRelative,
  emptyStore,
  exportForSync,
  logDone,
  parseStore,
  serializeStore,
  startProgram,
  type Store,
} from '../src/index.js';

function sampleStore(): Store {
  const plan = logDone(
    createPlan({
      id: 'p1',
      deedSlug: 'duha',
      title: 'ركعتا الضحى',
      unit: 'times',
      amount: 1,
      activeDaysPerWeek: 3,
      slots: ['09:00', '11:00'],
      createdOn: '2026-10-01',
    }),
    '2026-10-02',
    1,
  );
  const relative = createRelative({ id: 'r1', name: 'خالتي', relation: 'خالة', rule: { kind: 'weekdays', days: [5] } });
  const program = checkIn(
    startProgram({ sinSlug: 'secret-sin-slug', category: 'haqq_allah', hardToLeaveAtOnce: true, startedOn: '2026-10-01' }),
    '2026-10-02',
    'held',
    'ملاحظة خاصة جدًا',
  );
  return { v: 1, plans: [plan], relatives: [relative], programs: [program], settings: { hijriOffset: -1, reminderTimes: ['08:00'] } };
}

describe('parseStore', () => {
  it('never throws on garbage', () => {
    for (const bad of [undefined, null, 42, 'not json', '{"v":1', [], { v: 2, plans: [] }, { plans: [] }]) {
      expect(parseStore(bad)).toEqual(emptyStore());
    }
  });

  it('round-trips through serializeStore (string input)', () => {
    const store = sampleStore();
    expect(parseStore(serializeStore(store))).toEqual(store);
  });

  it('drops invalid entries one by one and keeps the rest', () => {
    const store = sampleStore();
    const raw = {
      ...store,
      plans: [store.plans[0], { id: 'bad', amount: -1 }, { ...store.plans[0] }],
      relatives: [store.relatives[0], { ...store.relatives[0], id: 'r2', name: 'خالتي 0791234567' }, 'x'],
      programs: [
        { ...store.programs[0], checkIns: [...(store.programs[0]?.checkIns ?? []), { date: 'bad', value: 'held' }] },
        { sinSlug: 'ghiba', category: 'haqq_ibad', path: 'gradual', startedOn: '2026-10-01', checkIns: [] },
      ],
      settings: { hijriOffset: 5, reminderTimes: ['08:00', '25:00'] },
    };
    const parsed = parseStore(raw);
    expect(parsed.plans.map((p) => p.id)).toEqual(['p1']); // invalid dropped, duplicate id dropped
    expect(parsed.relatives.map((r) => r.id)).toEqual(['r1']);
    expect(parsed.programs.map((p) => p.sinSlug)).toEqual(['secret-sin-slug']); // gradual haqq_ibad dropped
    expect(parsed.programs[0]?.checkIns).toHaveLength(1); // bad check-in dropped, program kept
    expect(parsed.settings).toEqual({ hijriOffset: 0, reminderTimes: ['08:00'] });
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
    const store = sampleStore();
    const payload = exportForSync(store);
    expect('programs' in payload).toBe(false);
    const text = JSON.stringify(payload);
    expect(text).not.toContain('secret-sin-slug');
    expect(text).not.toContain('ملاحظة خاصة');
    expect(payload.plans).toHaveLength(1);
    expect(payload.relatives).toHaveLength(1);
    expect(payload.settings.hijriOffset).toBe(-1);
  });

  it('excludes programs even when extra keys are smuggled in', () => {
    const store = { ...sampleStore(), sinData: 'x' } as Store;
    expect(Object.keys(exportForSync(store)).sort()).toEqual(['plans', 'relatives', 'settings', 'v']);
  });

  it('serializeStore keeps programs on the device', () => {
    expect(serializeStore(sampleStore())).toContain('secret-sin-slug');
  });
});
