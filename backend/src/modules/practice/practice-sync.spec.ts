import { BadRequestException, HttpException, PayloadTooLargeException } from '@nestjs/common';
import { compareVersions, planFields, relativeFields, type Plan } from '@thekra/practice-core';
import {
  containsProgramsKey,
  MAX_SYNC_ITEMS,
  parseSyncRequest,
  planRowToWire,
  planToWire,
  planVersion,
  relativeVersion,
  settingsVersion,
  wins,
  type PlanChange,
} from './practice-sync.js';

const NOW = new Date('2026-10-28T18:00:00.000Z');
const PLAN_ID = '11111111-1111-4111-8111-111111111111';
const T0 = '2026-10-28T10:00:00.000Z';
const REL_ID = '22222222-2222-4222-8222-222222222222';
const PLAN = {
  id: PLAN_ID,
  habitKey: 'duha',
  deedSlug: 'nawafil',
  title: 'Duha',
  unit: 'times',
  amount: 1,
  ceiling: null,
  activeDaysPerWeek: 3,
  slots: ['09:30', '11:00'],
  anchors: null,
  rule: { kind: 'daily' },
  createdOn: '2026-10-28',
  amountChangedOn: '2026-10-28',
  ebbSince: null,
  season: null,
  clientUpdatedAt: '2026-10-28T10:00:00.000Z',
  deletedAt: null,
};
const RELATIVE = {
  id: REL_ID,
  name: 'خالتي',
  relation: 'خالة',
  rule: { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-10-30' },
  lastContactedOn: null,
  clientUpdatedAt: '2026-10-28T10:00:00.000Z',
  deletedAt: null,
};

function errorOf(fn: () => unknown): { status: number; body: { code: string; details?: unknown } } {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const http = error as HttpException;
    return { status: http.getStatus(), body: http.getResponse() as { code: string; details?: unknown } };
  }
  throw new Error('expected an error');
}

const parse = (changes: Record<string, unknown>, since: string | null = null) => parseSyncRequest({ since, changes });

describe('parseSyncRequest', () => {
  it('accepts the contract shapes and drops unknown fields', () => {
    const request = parse(
      {
        settings: { hijriOffset: 1, reminderTimes: ['07:00'], freeMinutesPerDay: 60, clientUpdatedAt: '2026-10-28T09:00:00.000Z', extra: 1 },
        plans: [{ ...PLAN, extra: 'dropped' }],
        logs: [{ planId: PLAN_ID, date: '2026-10-28', amount: 1 }],
        relatives: [RELATIVE],
        contacts: [{ relativeId: REL_ID, date: '2026-10-20', deleted: false }],
      },
      '2026-10-27T00:00:00.000Z',
    );
    expect(request.since?.toISOString()).toBe('2026-10-27T00:00:00.000Z');
    expect(request.settings).toEqual({ hijriOffset: 1, reminderTimes: ['07:00'], freeMinutesPerDay: 60, clientUpdatedAt: '2026-10-28T09:00:00.000Z' });
    expect(request.plans).toEqual([{ kind: 'live', plan: PLAN }]);
    expect(request.relatives).toEqual([{ kind: 'live', relative: RELATIVE }]);
    expect(request.logs).toEqual([{ planId: PLAN_ID, date: '2026-10-28', amount: 1 }]);
    expect(request.contacts).toEqual([{ relativeId: REL_ID, date: '2026-10-20', deleted: false }]);
  });

  it('reads a tombstone with only id, clientUpdatedAt and deletedAt', () => {
    const request = parse({ plans: [{ id: PLAN_ID, clientUpdatedAt: '2026-10-28T11:00:00.000Z', deletedAt: '2026-10-28T11:00:00.000Z' }] });
    expect(request.plans).toEqual([
      { kind: 'tombstone', id: PLAN_ID, clientUpdatedAt: '2026-10-28T11:00:00.000Z', deletedAt: '2026-10-28T11:00:00.000Z' },
    ]);
  });

  it('merges duplicates inside one request with the same rules (newest plan, largest log, last contact)', () => {
    const request = parse({
      plans: [{ ...PLAN, title: 'newer', clientUpdatedAt: '2026-10-28T12:00:00.000Z' }, PLAN],
      logs: [
        { planId: PLAN_ID, date: '2026-10-28', amount: 3 },
        { planId: PLAN_ID, date: '2026-10-28', amount: 2 },
      ],
      contacts: [
        { relativeId: REL_ID, date: '2026-10-20' },
        { relativeId: REL_ID, date: '2026-10-20', deleted: true },
      ],
    });
    expect(request.plans).toHaveLength(1);
    expect(request.plans[0]).toMatchObject({ plan: { title: 'newer' } });
    expect(request.logs).toEqual([{ planId: PLAN_ID, date: '2026-10-28', amount: 3 }]);
    expect(request.contacts).toEqual([{ relativeId: REL_ID, date: '2026-10-20', deleted: true }]);
  });

  it('a corrected day: 0 is allowed only with correctedAt, and the later correction wins a duplicate', () => {
    const fixedAt = '2026-10-28T12:00:00.000Z';
    const request = parse({
      logs: [
        { planId: PLAN_ID, date: '2026-10-28', amount: 9 },
        { planId: PLAN_ID, date: '2026-10-28', amount: 0, correctedAt: fixedAt },
        { planId: PLAN_ID, date: '2026-10-28', amount: 5, correctedAt: '2026-10-28T11:00:00.000Z' },
      ],
    });
    expect(request.logs).toEqual([{ planId: PLAN_ID, date: '2026-10-28', amount: 0, correctedAt: fixedAt }]);
    expect(errorOf(() => parse({ logs: [{ planId: PLAN_ID, date: '2026-10-28', amount: 0 }] })).status).toBe(400);
    expect(errorOf(() => parse({ logs: [{ planId: PLAN_ID, date: '2026-10-28', amount: 1, correctedAt: 'yesterday' }] })).status).toBe(400);
  });

  it('keeps values exactly as sent (client times, names, fractional amounts)', () => {
    const request = parse({
      plans: [{ ...PLAN, amount: 2.5, clientUpdatedAt: '2030-01-01T00:00:00.000Z' }],
      relatives: [{ ...RELATIVE, name: ' خالتي ' }],
      logs: [{ planId: PLAN_ID, date: '2026-10-28', amount: 0.5 }],
    });
    expect(request.plans[0]).toMatchObject({ plan: { amount: 2.5, clientUpdatedAt: '2030-01-01T00:00:00.000Z' } });
    expect(request.relatives[0]).toMatchObject({ relative: { name: ' خالتي ' } });
    expect(request.logs[0]?.amount).toBe(0.5);
  });

  it('400 PRACTICE_PROGRAMS_NOT_ALLOWED for a programs key anywhere, before anything else', () => {
    for (const body of [{ programs: [] }, { since: null, changes: { plans: [{ ...PLAN, programs: 1 }] } }]) {
      const { status, body: error } = errorOf(() => parseSyncRequest(body));
      expect(status).toBe(400);
      expect(error.code).toBe('PRACTICE_PROGRAMS_NOT_ALLOWED');
    }
    expect(containsProgramsKey({ a: [{ b: 1 }] })).toBe(false);
  });

  it('413 PRACTICE_TOO_LARGE above 500 items', () => {
    const logs = Array.from({ length: MAX_SYNC_ITEMS + 1 }, () => ({ planId: PLAN_ID, date: '2026-10-28', amount: 1 }));
    const { status, body } = errorOf(() => parse({ logs }));
    expect(status).toBe(413);
    expect(body.code).toBe('PRACTICE_TOO_LARGE');
    expect(() => parse({ logs: logs.slice(1) })).not.toThrow();
    expect(new PayloadTooLargeException()).toBeInstanceOf(HttpException);
  });

  it('400 PRACTICE_INVALID with the list and index, never the value', () => {
    const cases: Array<[Record<string, unknown>, string, number]> = [
      [{ plans: [PLAN, { ...PLAN, id: 'not-a-uuid' }] }, 'plans', 1],
      [{ plans: [{ ...PLAN, activeDaysPerWeek: 1 }] }, 'plans', 0],
      [{ plans: [{ ...PLAN, rule: { kind: 'hijriYearly', month: 13, day: 1 } }] }, 'plans', 0],
      [{ plans: [{ ...PLAN, amount: 0 }] }, 'plans', 0],
      [{ relatives: [{ ...RELATIVE, name: '0791234567' }] }, 'relatives', 0],
      [{ relatives: [{ ...RELATIVE, relation: 'x@y.com' }] }, 'relatives', 0],
      [{ relatives: [{ ...RELATIVE, rule: { kind: 'daily' } }] }, 'relatives', 0],
      [{ logs: [{ planId: PLAN_ID, date: '2026-02-30', amount: 1 }] }, 'logs', 0],
      [{ logs: [{ planId: PLAN_ID, date: '2026-10-28', amount: 0 }] }, 'logs', 0],
      [{ contacts: [{ relativeId: REL_ID, date: '2026-10-28', deleted: 'yes' }] }, 'contacts', 0],
      [{ settings: { hijriOffset: 3, clientUpdatedAt: '2026-10-28T09:00:00.000Z' } }, 'settings', 0],
      [{ plans: [{ ...PLAN, clientUpdatedAt: '2026-10-28 10:00' }] }, 'plans', 0],
    ];
    for (const [changes, kind, index] of cases) {
      const { status, body } = errorOf(() => parse(changes));
      expect(status, JSON.stringify(changes)).toBe(400);
      expect(body.code).toBe('PRACTICE_INVALID');
      expect(body.details).toMatchObject({ kind, index });
      expect(JSON.stringify(body)).not.toContain('0791234567');
    }
    expect(errorOf(() => parseSyncRequest({ since: 'yesterday' })).body.code).toBe('PRACTICE_INVALID');
    expect(errorOf(() => parse({ plans: {} })).body.details).toMatchObject({ kind: 'plans', index: null });
    expect(new BadRequestException()).toBeInstanceOf(HttpException);
  });

  it('planToWire turns DB dates into YYYY-MM-DD and timestamps into ISO', () => {
    const wire = planToWire({
      ...PLAN,
      userId: 'u',
      rule: { kind: 'daily' },
      createdOn: new Date('2026-10-28T00:00:00.000Z'),
      amountChangedOn: new Date('2026-10-28T00:00:00.000Z'),
      ebbSince: null,
      season: null,
      clientUpdatedAt: new Date('2026-10-28T10:00:00.000Z'),
      updatedAt: NOW,
      deletedAt: null,
    });
    expect(wire).toEqual(PLAN);
  });

  it('serialises a deleted row as {id, clientUpdatedAt, deletedAt} only', () => {
    const row = {
      ...PLAN,
      userId: 'u',
      createdOn: new Date('2026-10-28T00:00:00.000Z'),
      amountChangedOn: new Date('2026-10-28T00:00:00.000Z'),
      ebbSince: null,
      clientUpdatedAt: new Date('2026-10-28T11:00:00.000Z'),
      updatedAt: NOW,
      deletedAt: new Date('2026-10-28T11:00:00.000Z'),
    };
    expect(planRowToWire(row)).toEqual({ id: PLAN_ID, clientUpdatedAt: '2026-10-28T11:00:00.000Z', deletedAt: '2026-10-28T11:00:00.000Z' });
  });
});

describe('versions (must match practice-core compareVersions on every replica)', () => {
  const live = (overrides: Record<string, unknown> = {}): PlanChange => {
    const [change] = parse({ plans: [{ ...PLAN, ...overrides }] }).plans;
    return change!;
  };
  const tomb = (at: string): PlanChange => ({ kind: 'tombstone', id: PLAN_ID, clientUpdatedAt: at, deletedAt: at });

  it('uses practice-core planFields / relativeFields for the canonical content', () => {
    const corePlan: Plan = {
      id: PLAN_ID, habitKey: 'duha', deedSlug: 'nawafil', title: 'Duha', unit: 'times', amount: 1, activeDaysPerWeek: 3,
      slots: ['09:30', '11:00'], rule: { kind: 'daily' }, createdOn: '2026-10-28', amountChangedOn: '2026-10-28', log: {},
    };
    expect(planVersion(live()).content).toBe(JSON.stringify(planFields(corePlan)));
    const [rel] = parse({ relatives: [RELATIVE] }).relatives;
    expect(relativeVersion(rel!).content).toBe(
      JSON.stringify(relativeFields({ id: REL_ID, name: RELATIVE.name, relation: RELATIVE.relation, rule: RELATIVE.rule as Plan['rule'] & { kind: 'everyNWeeks' }, history: [] })),
    );
    expect(settingsVersion({ hijriOffset: 1, reminderTimes: ['07:00'], freeMinutesPerDay: null, clientUpdatedAt: NOW.toISOString() }).content).toBe(
      '{"hijriOffset":1,"reminderTimes":["07:00"],"freeMinutesPerDay":null}',
    );
  });

  it('carries prayer anchors: validated, canonical in the version, back on the wire', () => {
    const anchors = [{ slot: '09:30', prayer: 'fajr', offset: 10 }];
    const change = live({ anchors });
    expect(change.kind === 'live' && change.plan.anchors).toEqual(anchors);
    const corePlan: Plan = {
      id: PLAN_ID, habitKey: 'duha', deedSlug: 'nawafil', title: 'Duha', unit: 'times', amount: 1, activeDaysPerWeek: 3,
      slots: ['09:30', '11:00'], anchors: [{ slot: '09:30', prayer: 'fajr', offset: 10 }], rule: { kind: 'daily' },
      createdOn: '2026-10-28', amountChangedOn: '2026-10-28', log: {},
    };
    expect(planVersion(change).content).toBe(JSON.stringify(planFields(corePlan)));
    // A plan without anchors keeps the content it had before anchors existed.
    expect(planVersion(live()).content).not.toContain('anchors');
    for (const bad of [[{ slot: '09:30', prayer: 'noon', offset: 10 }], [{ slot: '09:30', prayer: 'fajr', offset: 999 }], 'fajr']) {
      const { status, body } = errorOf(() => parse({ plans: [{ ...PLAN, anchors: bad }] }));
      expect(status).toBe(400);
      expect(body.details).toMatchObject({ kind: 'plans', index: 0 });
    }
  });

  it('later time wins; at equal times a tombstone wins, then the larger canonical JSON; equal never rewrites', () => {
    expect(wins(planVersion(live()), planVersion(live({ clientUpdatedAt: '2026-10-28T10:00:00.001Z' })))).toBe(true);
    expect(wins(planVersion(live()), planVersion(live({ clientUpdatedAt: '2026-10-28T09:59:59.999Z' })))).toBe(false);
    expect(wins(planVersion(live()), planVersion(tomb(PLAN.clientUpdatedAt)))).toBe(true);
    expect(wins(planVersion(tomb(PLAN.clientUpdatedAt)), planVersion(live()))).toBe(false);
    const a = planVersion(live({ title: 'A' }));
    const b = planVersion(live({ title: 'B' }));
    expect(wins(a, b)).toBe(true);
    expect(wins(b, a)).toBe(false);
    expect(wins(a, a)).toBe(false);
    expect(wins(null, a)).toBe(true);
    // The same decision practice-core makes on the device.
    for (const [x, y] of [[a, b], [b, a], [planVersion(live()), planVersion(tomb(PLAN.clientUpdatedAt))]] as const) {
      expect(wins(x, y)).toBe(compareVersions(x, y) < 0);
    }
  });

  it('merges duplicates inside one request with the same ordering', () => {
    const request = parse({ plans: [{ ...PLAN, title: 'B' }, { ...PLAN, title: 'A' }, { id: PLAN_ID, clientUpdatedAt: T0, deletedAt: T0 }] });
    expect(request.plans).toEqual([{ kind: 'tombstone', id: PLAN_ID, clientUpdatedAt: T0, deletedAt: T0 }]);
    expect(parse({ plans: [{ ...PLAN, title: 'A' }, { ...PLAN, title: 'B' }] }).plans[0]).toMatchObject({ plan: { title: 'B' } });
  });
});
