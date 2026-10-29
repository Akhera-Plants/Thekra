import { describe, expect, it } from 'vitest';
import {
  anchorForSlot,
  applyServerChanges,
  buildSyncRequest,
  clonePlan,
  createPlan,
  emptyStore,
  parseStore,
  planAnchors,
  planFields,
  serializeStore,
  upsertPlan,
  validateAnchors,
  validatePlan,
  type Plan,
  type SyncResponse,
} from '../src/index.js';

const NOW = '2026-10-29T08:00:00.000Z';

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    ...createPlan(
      {
        id: '0b9b0c1e-0000-4000-8000-000000000001',
        deedSlug: 'dhikr',
        title: 'أذكار',
        unit: 'count',
        amount: 10,
        activeDaysPerWeek: 3,
        slots: ['05:10', '21:00'],
        anchors: [{ slot: '05:10', prayer: 'fajr', offset: 10 }],
        createdOn: '2026-10-29',
      },
      NOW,
    ),
    ...overrides,
  };
}

describe('validateAnchors / validatePlan', () => {
  it('accepts anchors that follow a prayer', () => {
    expect(validatePlan(plan())).toBeNull();
    expect(validateAnchors([{ slot: '13:00', prayer: 'dhuhr', offset: 0 }])).toBeNull();
  });

  it('refuses a bad prayer, offset, slot or a slot named twice', () => {
    expect(validateAnchors([{ slot: '05:10', prayer: 'duha', offset: 10 }])).toMatch(/prayer/);
    expect(validateAnchors([{ slot: '05:10', prayer: 'fajr', offset: -5 }])).toMatch(/offset/);
    expect(validateAnchors([{ slot: '05:10', prayer: 'fajr', offset: 2.5 }])).toMatch(/offset/);
    expect(validateAnchors([{ slot: '05:10', prayer: 'fajr', offset: 181 }])).toMatch(/offset/);
    expect(validateAnchors([{ slot: '5:10', prayer: 'fajr', offset: 10 }])).toMatch(/slot/);
    expect(
      validateAnchors([
        { slot: '05:10', prayer: 'fajr', offset: 10 },
        { slot: '05:10', prayer: 'asr', offset: 10 },
      ]),
    ).toMatch(/once/);
    expect(validatePlan({ ...plan(), anchors: 'fajr' })).toMatch(/anchors/);
  });

  it('keeps a plan valid when a client removed an anchored slot (the anchor is ignored)', () => {
    const edited = { ...plan(), slots: ['21:00'] };
    expect(validatePlan(edited)).toBeNull();
    expect(planAnchors(edited)).toEqual([]);
    expect(anchorForSlot(edited, '05:10')).toBeUndefined();
    expect(clonePlan(edited).anchors).toBeUndefined();
  });

  it('finds the anchor of a slot', () => {
    expect(anchorForSlot(plan(), '05:10')).toEqual({ slot: '05:10', prayer: 'fajr', offset: 10 });
    expect(anchorForSlot(plan(), '21:00')).toBeUndefined();
  });
});

describe('storage', () => {
  it('round-trips anchors through the on-device store, dropping unknown fields', () => {
    const raw = JSON.parse(serializeStore(upsertPlan(emptyStore(), plan(), NOW))) as { plans: Record<string, unknown>[] };
    const anchors = raw.plans[0]?.anchors as Record<string, unknown>[];
    anchors[0] = { ...anchors[0], extra: 'x' };
    const back = parseStore(raw);
    expect(back.plans[0]?.anchors).toEqual([{ slot: '05:10', prayer: 'fajr', offset: 10 }]);
  });

  it('leaves the versioned content of a plan without anchors unchanged', () => {
    const fields = planFields(plan({ anchors: undefined }));
    expect('anchors' in fields).toBe(false);
    expect(planFields(plan()).anchors).toEqual([{ slot: '05:10', prayer: 'fajr', offset: 10 }]);
  });
});

describe('sync', () => {
  it('sends anchors and takes them back from the server, acked', () => {
    const store = upsertPlan(emptyStore(), plan(), NOW);
    const body = buildSyncRequest(store);
    const wire = body.changes.plans[0];
    expect(wire?.anchors).toEqual([{ slot: '05:10', prayer: 'fajr', offset: 10 }]);

    const response: SyncResponse = { serverTime: NOW, settings: null, plans: body.changes.plans, logs: [], relatives: [], contacts: [] };
    const synced = applyServerChanges(store, response);
    expect(synced.plans[0]?.anchors).toEqual([{ slot: '05:10', prayer: 'fajr', offset: 10 }]);
    expect(buildSyncRequest(synced).changes.plans).toEqual([]);

    // Another device receives the plan: anchors arrive intact.
    const other = applyServerChanges(emptyStore(), response);
    expect(other.plans[0]?.anchors).toEqual([{ slot: '05:10', prayer: 'fajr', offset: 10 }]);
  });

  it('reads `anchors: null` from the server as no anchors, and skips invalid anchors', () => {
    const store = upsertPlan(emptyStore(), plan({ anchors: undefined }), NOW);
    const [wire] = buildSyncRequest(store).changes.plans;
    const withNull: SyncResponse = {
      serverTime: NOW,
      settings: null,
      plans: [{ ...wire, anchors: null } as never],
      logs: [],
      relatives: [],
      contacts: [],
    };
    const synced = applyServerChanges(emptyStore(), withNull);
    expect(synced.plans[0]?.anchors).toBeUndefined();

    const bad: SyncResponse = { ...withNull, plans: [{ ...wire, anchors: [{ slot: '05:10', prayer: 'noon', offset: 1 }] } as never] };
    expect(applyServerChanges(emptyStore(), bad).plans).toEqual([]);
  });
});
