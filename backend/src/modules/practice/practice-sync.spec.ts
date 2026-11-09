import { BadRequestException, HttpException, PayloadTooLargeException } from '@nestjs/common';
import { compareVersions, planFields, relativeFields, settingsContent, type Plan } from '@thekra/practice-core';
import {
  containsProgramsKey,
  fardWins,
  homeSectionsOf,
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
  rule: { kind: 'daily' },
  createdOn: '2026-10-28',
  amountChangedOn: '2026-10-28',
  ebbSince: null,
  season: null,
  pausedOn: null,
  resumedOn: null,
  establishedOn: null,
  slotAnchors: null,
  loops: null,
  minimum: null,
  startAmount: null,
  restartedOn: null,
  clientUpdatedAt: '2026-10-28T10:00:00.000Z',
  deletedAt: null,
};
/** A plan as a client from before 2026-10-31 sends it: no pausedOn / resumedOn / establishedOn / slotAnchors / loops (nor round 6 fields). */
const {
  pausedOn: _p,
  resumedOn: _r,
  establishedOn: _e,
  slotAnchors: _a,
  loops: _l,
  minimum: _m,
  startAmount: _s,
  restartedOn: _ro,
  ...OLD_PLAN
} = PLAN;
const LOOP = { id: 'loop-1', cue: 'بعد الفجر', craving: 'السكينة', routine: 'أذكار الصباح', reward: 'طمأنينة', updatedAt: '2026-10-28T10:00:00Z' };
const RELATIVE = {
  id: REL_ID,
  name: 'خالتي',
  relation: 'خالة',
  rule: { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-10-30' },
  circle: 'kin',
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
    expect(request.settings).toEqual({
      hijriOffset: 1,
      reminderTimes: ['07:00'],
      freeMinutesPerDay: 60,
      excusedDays: [],
      homeSections: null,
      fardTracking: false,
      // Round 6: an older client omits these; they read as the defaults.
      dayStates: null,
      qada: null,
      lightenCovered: true,
      reciter: null,
      clientUpdatedAt: '2026-10-28T09:00:00.000Z',
    });
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
      [{ plans: [{ ...PLAN, activeDaysPerWeek: 0 }] }, 'plans', 0],
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
      [{ plans: [{ ...PLAN, resumedOn: '2026-10-29' }] }, 'plans', 0],
      [{ plans: [{ ...PLAN, pausedOn: '2026-10-30', resumedOn: '2026-10-29' }] }, 'plans', 0],
      [{ plans: [{ ...PLAN, establishedOn: 'soon' }] }, 'plans', 0],
      [{ relatives: [{ ...RELATIVE, circle: 'colleagues' }] }, 'relatives', 0],
      [{ settings: { excusedDays: ['2026-10-28', '2026-10-27'], clientUpdatedAt: '2026-10-28T09:00:00.000Z' } }, 'settings', 0],
      [{ settings: { excusedDays: ['2026-13-01'], clientUpdatedAt: '2026-10-28T09:00:00.000Z' } }, 'settings', 0],
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
      pausedOn: null,
      resumedOn: null,
      establishedOn: null,
      clientUpdatedAt: new Date('2026-10-28T10:00:00.000Z'),
      updatedAt: NOW,
      deletedAt: null,
    });
    expect(wire).toEqual(PLAN);
    // jsonb reorders keys: the wire copy is back in the canonical order; bad stored loops read as none.
    const reordered = { updatedAt: LOOP.updatedAt, reward: LOOP.reward, routine: LOOP.routine, craving: LOOP.craving, cue: LOOP.cue, id: LOOP.id };
    const looped = planToWire({ ...PLAN, userId: 'u', createdOn: new Date('2026-10-28'), amountChangedOn: new Date('2026-10-28'), ebbSince: null, pausedOn: null, resumedOn: null, establishedOn: null, clientUpdatedAt: NOW, updatedAt: NOW, deletedAt: null, loops: [reordered] });
    expect(JSON.stringify(looped.loops)).toBe(JSON.stringify([LOOP]));
    expect(planToWire({ ...PLAN, userId: 'u', createdOn: new Date('2026-10-28'), amountChangedOn: new Date('2026-10-28'), ebbSince: null, pausedOn: null, resumedOn: null, establishedOn: null, clientUpdatedAt: NOW, updatedAt: NOW, deletedAt: null, loops: [{ id: 'x' }] }).loops).toBeNull();
    const paused = planToWire({
      ...PLAN,
      userId: 'u',
      createdOn: new Date('2026-10-28T00:00:00.000Z'),
      amountChangedOn: new Date('2026-10-28T00:00:00.000Z'),
      pausedOn: new Date('2026-10-29T00:00:00.000Z'),
      resumedOn: null,
      establishedOn: new Date('2026-10-28T00:00:00.000Z'),
      clientUpdatedAt: new Date('2026-10-28T10:00:00.000Z'),
      updatedAt: NOW,
      deletedAt: null,
    });
    expect(paused).toMatchObject({ pausedOn: '2026-10-29', resumedOn: null, establishedOn: '2026-10-28' });
  });

  it('serialises a deleted row as {id, clientUpdatedAt, deletedAt} only', () => {
    const row = {
      ...PLAN,
      userId: 'u',
      createdOn: new Date('2026-10-28T00:00:00.000Z'),
      amountChangedOn: new Date('2026-10-28T00:00:00.000Z'),
      ebbSince: null,
      pausedOn: null,
      resumedOn: null,
      establishedOn: null,
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
    expect(
      settingsVersion({ hijriOffset: 1, reminderTimes: ['07:00'], freeMinutesPerDay: null, excusedDays: [], clientUpdatedAt: NOW.toISOString() }).content,
    ).toBe('{"hijriOffset":1,"reminderTimes":["07:00"],"freeMinutesPerDay":null}');
    expect(
      settingsVersion({ hijriOffset: 1, reminderTimes: [], freeMinutesPerDay: null, excusedDays: ['2026-10-27'], clientUpdatedAt: NOW.toISOString() }).content,
    ).toBe(settingsContent({ hijriOffset: 1, reminderTimes: [], freeMinutesPerDay: null, excusedDays: ['2026-10-27'] }));
  });

  it('phase-2 fields: in the canonical content only when set, so old and new clients agree on older plans', () => {
    const [old] = parse({ plans: [OLD_PLAN] }).plans;
    expect(old).toEqual({ kind: 'live', plan: PLAN });
    expect(planVersion(old!).content).toBe(planVersion(live()).content);
    const paused = planVersion(live({ pausedOn: '2026-10-29', establishedOn: '2026-10-28' })).content;
    expect(JSON.parse(paused)).toMatchObject({ pausedOn: '2026-10-29', establishedOn: '2026-10-28' });
    const anchored = live({ slotAnchors: ['after-fajr', null] });
    expect(anchored.kind === 'live' && anchored.plan.slotAnchors).toEqual(['after-fajr', null]);
    expect(JSON.parse(planVersion(anchored).content)).toMatchObject({ slotAnchors: ['after-fajr', null] });
    expect(live({ slotAnchors: [null, null] })).toEqual({ kind: 'live', plan: PLAN });
    expect(() => parse({ plans: [{ ...PLAN, slotAnchors: ['after-noon', null] }] })).toThrow();
    expect(() => parse({ plans: [{ ...PLAN, slotAnchors: ['after-fajr'] }] })).toThrow();
    const looped = live({ loops: [{ ...LOOP, extra: 'dropped' }] });
    expect(looped.kind === 'live' && looped.plan.loops).toEqual([LOOP]);
    // Kept exactly as written (no timestamp normalisation), in the practice-core field order.
    expect(JSON.parse(planVersion(looped).content).loops).toEqual([LOOP]);
    const coreLooped: Plan = {
      id: PLAN_ID, habitKey: 'duha', deedSlug: 'nawafil', title: 'Duha', unit: 'times', amount: 1, activeDaysPerWeek: 3,
      slots: ['09:30', '11:00'], rule: { kind: 'daily' }, createdOn: '2026-10-28', amountChangedOn: '2026-10-28', log: {}, loops: [LOOP],
    };
    expect(planVersion(looped).content).toBe(JSON.stringify(planFields(coreLooped)));
    expect(live({ loops: [] })).toEqual({ kind: 'live', plan: PLAN });
    expect(() => parse({ plans: [{ ...PLAN, loops: [{ ...LOOP, routine: '' }] }] })).toThrow();
    expect(() => parse({ plans: [{ ...PLAN, loops: [LOOP, LOOP] }] })).toThrow();
    expect(() => parse({ plans: [{ ...PLAN, loops: [{ ...LOOP, cue: 'x'.repeat(301) }] }] })).toThrow();
    expect(() => parse({ plans: [{ ...PLAN, loops: {} }] })).toThrow();
    const { circle: _c, ...oldRelative } = RELATIVE;
    expect(parse({ relatives: [oldRelative] }).relatives[0]).toMatchObject({ relative: { circle: 'kin' } });
    const [neighbor] = parse({ relatives: [{ ...RELATIVE, circle: 'neighbors' }] }).relatives;
    expect(JSON.parse(relativeVersion(neighbor!).content)).toMatchObject({ circle: 'neighbors' });
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

describe('round 5: home sections, «الفرائض»', () => {
  const settings = (extra: Record<string, unknown>) => ({
    changes: { settings: { hijriOffset: 0, reminderTimes: [], freeMinutesPerDay: null, clientUpdatedAt: T0, ...extra } },
  });
  const invalid = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      return ((error as HttpException).getResponse() as { details: { kind: string; index: number | null } }).details;
    }
    throw new Error('expected a 400');
  };

  it('settings: homeSections in canonical order (unknown fields dropped), fardTracking a boolean', () => {
    const request = parseSyncRequest(settings({ homeSections: [{ visible: false, key: 'sources', x: 1 }, { key: 'wird', visible: true }], fardTracking: true }));
    expect(request.settings?.homeSections).toEqual([
      { key: 'sources', visible: false },
      { key: 'wird', visible: true },
    ]);
    expect(request.settings?.fardTracking).toBe(true);
    // An older client omits both: defaults, and the canonical content is the one it always had.
    const old = parseSyncRequest(settings({}));
    expect(old.settings).toMatchObject({ homeSections: null, fardTracking: false });
    expect(settingsVersion(old.settings!).content).toBe(settingsContent({ hijriOffset: 0, reminderTimes: [], freeMinutesPerDay: null }));
    expect(settingsVersion(request.settings!).content).toBe(
      settingsContent({ hijriOffset: 0, homeSections: request.settings!.homeSections, fardTracking: true }),
    );
    expect(invalid(() => parseSyncRequest(settings({ homeSections: [{ key: 'nope', visible: true }] })))).toMatchObject({ kind: 'settings' });
    expect(invalid(() => parseSyncRequest(settings({ homeSections: [{ key: 'wird', visible: true }, { key: 'wird', visible: false }] })))).toMatchObject({
      kind: 'settings',
    });
    expect(invalid(() => parseSyncRequest(settings({ fardTracking: 'yes' })))).toMatchObject({ kind: 'settings' });
  });

  it('fard: validates each mark, refuses future days, merges duplicates with the later write', () => {
    const mark = (extra: Record<string, unknown> = {}) => ({ date: '2026-10-28', prayer: 'fajr', status: 'onTime', clientUpdatedAt: T0, ...extra });
    const request = parseSyncRequest(
      {
        changes: {
          fard: [
            mark(),
            mark({ status: null, clientUpdatedAt: '2026-10-28T11:00:00.000Z' }),
            mark({ prayer: 'isha', status: 'qada', extra: 1 }),
            mark({ date: '2026-10-29' }),
          ],
        },
      },
      NOW,
    );
    expect(request.fard).toEqual([
      { date: '2026-10-28', prayer: 'fajr', status: null, clientUpdatedAt: '2026-10-28T11:00:00.000Z' },
      { date: '2026-10-28', prayer: 'isha', status: 'qada', clientUpdatedAt: T0 },
      { date: '2026-10-29', prayer: 'fajr', status: 'onTime', clientUpdatedAt: T0 },
    ]);
    expect(invalid(() => parseSyncRequest({ changes: { fard: [mark(), mark({ date: '2026-10-31' })] } }, NOW))).toEqual({
      kind: 'fard',
      index: 1,
      reason: 'date must not be in the future',
    });
    expect(invalid(() => parseSyncRequest({ changes: { fard: [mark({ prayer: 'witr' })] } }, NOW))).toMatchObject({ kind: 'fard', index: 0 });
    expect(invalid(() => parseSyncRequest({ changes: { fard: [mark({ status: 'late' })] } }, NOW))).toMatchObject({ kind: 'fard', index: 0 });
    expect(invalid(() => parseSyncRequest({ changes: { fard: 'x' } }, NOW))).toMatchObject({ kind: 'fard', index: null });
  });

  it('fard marks count toward the 500-item limit', () => {
    const fard = Array.from({ length: MAX_SYNC_ITEMS + 1 }, (_, i) => ({
      date: '2026-10-01',
      prayer: 'fajr',
      status: 'onTime',
      clientUpdatedAt: new Date(Date.parse(T0) + i).toISOString(),
    }));
    expect(() => parseSyncRequest({ changes: { fard } }, NOW)).toThrow(PayloadTooLargeException);
  });

  it('fardWins: the later write; at equal times a cleared mark, then the larger status', () => {
    expect(fardWins(null, { status: 'onTime', clientUpdatedAt: T0 })).toBe(true);
    expect(fardWins({ status: 'onTime', clientUpdatedAt: T0 }, { status: 'qada', clientUpdatedAt: '2026-10-28T09:00:00.000Z' })).toBe(false);
    expect(fardWins({ status: 'onTime', clientUpdatedAt: T0 }, { status: null, clientUpdatedAt: T0 })).toBe(true);
    expect(fardWins({ status: 'onTime', clientUpdatedAt: T0 }, { status: 'qada', clientUpdatedAt: T0 })).toBe(true);
    expect(fardWins({ status: 'qada', clientUpdatedAt: T0 }, { status: 'qada', clientUpdatedAt: T0 })).toBe(false);
  });

  it('homeSectionsOf: canonical order from jsonb, null for bad data', () => {
    expect(homeSectionsOf([{ visible: true, key: 'wird' }])).toEqual([{ key: 'wird', visible: true }]);
    expect(homeSectionsOf(null)).toBeNull();
    expect(homeSectionsOf([{ key: 'x', visible: true }])).toBeNull();
    expect(homeSectionsOf({})).toBeNull();
  });
});

describe('round 6 (docs/plan/2026-11-09-owner-round-6.md, sync contract «Round 6»)', () => {
  const SETTINGS = { hijriOffset: 0, reminderTimes: [], clientUpdatedAt: '2026-10-28T09:00:00.000Z' };
  const QADA = { owed: { fajr: 3, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, any: 10 }, perDay: 2, startedOn: '2026-10-20' };
  const QUOTE = '5671bf91-6335-49b4-9011-61c74dd1c460';

  it('accepts the new settings fields in canonical order and versions them like practice-core', () => {
    const request = parse({
      settings: {
        ...SETTINGS,
        dayStates: [{ state: 'busy', date: '2026-10-27' }, { date: '2026-10-28', state: 'sick' }],
        qada: { startedOn: QADA.startedOn, perDay: 2, owed: { any: 10, fajr: 3 } },
        lightenCovered: false,
        reciter: 'husary',
      },
    });
    expect(request.settings).toMatchObject({
      dayStates: [{ date: '2026-10-27', state: 'busy' }, { date: '2026-10-28', state: 'sick' }],
      qada: QADA,
      lightenCovered: false,
      reciter: 'husary',
    });
    expect(JSON.stringify(request.settings?.qada)).toBe(JSON.stringify(QADA));
    const s = request.settings as NonNullable<typeof request.settings>;
    expect(settingsVersion(s).content).toBe(settingsContent(s));
    expect(settingsVersion(s).content).toContain('"reciter":"husary"');
  });

  it('accepts the new plan fields and keeps them in the canonical content', () => {
    const request = parse({ plans: [{ ...PLAN, amount: 5, minimum: 2, startAmount: 1, restartedOn: '2026-10-28' }] });
    const change = request.plans[0] as Extract<PlanChange, { kind: 'live' }>;
    expect(change.plan).toMatchObject({ minimum: 2, startAmount: 1, restartedOn: '2026-10-28' });
    expect(planVersion(change).content).toContain('"minimum":2,"startAmount":1,"restartedOn":"2026-10-28"');
  });

  it('parses reflections, «قضاء» day counts and read marks; merges duplicates with the practice-core rules', () => {
    const later = '2026-10-28T11:00:00.000Z';
    const request = parse({
      reflections: [
        { planId: PLAN_ID, date: '2026-10-28', helped: 'صحبة', hard: null, note: '', clientUpdatedAt: T0, extra: 1 },
        { planId: PLAN_ID, date: '2026-10-28', hard: 'السهر', clientUpdatedAt: later },
      ],
      qadaLogs: [
        { date: '2026-10-28', prayer: 'fajr', count: 3, clientUpdatedAt: later },
        { date: '2026-10-28', prayer: 'fajr', count: 9, clientUpdatedAt: T0 },
      ],
      reads: [{ quoteId: QUOTE.toUpperCase(), read: true, clientUpdatedAt: T0 }],
    });
    expect(request.reflections).toEqual([{ planId: PLAN_ID, date: '2026-10-28', helped: null, hard: 'السهر', note: null, clientUpdatedAt: later }]);
    expect(request.qadaLogs).toEqual([{ date: '2026-10-28', prayer: 'fajr', count: 3, clientUpdatedAt: later }]);
    expect(request.reads).toEqual([{ quoteId: QUOTE, read: true, clientUpdatedAt: T0 }]);
  });

  it('rejects bad round-6 items with their index, and counts them toward the item limit', () => {
    const cases: [Record<string, unknown>, string, number][] = [
      [{ settings: { ...SETTINGS, dayStates: [{ date: '2026-10-28', state: 'tired' }] } }, 'settings', 0],
      [{ settings: { ...SETTINGS, qada: { owed: { fajr: 0 }, perDay: 1, startedOn: '2026-10-28' } } }, 'settings', 0],
      [{ settings: { ...SETTINGS, reciter: 'nobody' } }, 'settings', 0],
      [{ settings: { ...SETTINGS, lightenCovered: 'no' } }, 'settings', 0],
      [{ plans: [{ ...PLAN, minimum: 2 }] }, 'plans', 0],
      [{ plans: [{ ...PLAN, restartedOn: 'today' }] }, 'plans', 0],
      [{ reflections: [{ planId: PLAN_ID, date: '2026-10-28', helped: 'x'.repeat(301), clientUpdatedAt: T0 }] }, 'reflections', 0],
      [{ reflections: [{ planId: PLAN_ID, date: '2026-11-05', helped: 'x', clientUpdatedAt: T0 }] }, 'reflections', 0],
      [{ qadaLogs: [{ date: '2026-10-28', prayer: 'witr', count: 1, clientUpdatedAt: T0 }] }, 'qadaLogs', 0],
      [{ qadaLogs: [{ date: '2026-10-28', prayer: 'fajr', count: 101, clientUpdatedAt: T0 }] }, 'qadaLogs', 0],
      [{ reads: [{ quoteId: 'not-a-uuid', read: true, clientUpdatedAt: T0 }] }, 'reads', 0],
    ];
    for (const [changes, kind, index] of cases) {
      const { status, body } = errorOf(() => parseSyncRequest({ since: null, changes }, NOW));
      expect(status, JSON.stringify(changes)).toBe(400);
      expect(body.details).toMatchObject({ kind, index });
    }
    const reads = Array.from({ length: MAX_SYNC_ITEMS + 1 }, (_, i) => ({
      quoteId: `5671bf91-6335-49b4-9011-${String(i).padStart(12, '0')}`,
      read: true,
      clientUpdatedAt: T0,
    }));
    expect(() => parseSyncRequest({ changes: { reads } }, NOW)).toThrow(PayloadTooLargeException);
  });

  it('a stored plan row reads its round-6 columns', () => {
    const row = {
      ...PLAN,
      userId: 'u',
      rule: { kind: 'daily' },
      createdOn: new Date('2026-10-28T00:00:00.000Z'),
      amountChangedOn: new Date('2026-10-28T00:00:00.000Z'),
      ebbSince: null,
      season: null,
      pausedOn: null,
      resumedOn: null,
      establishedOn: null,
      minimum: 1,
      startAmount: 1,
      restartedOn: new Date('2026-10-28T00:00:00.000Z'),
      clientUpdatedAt: new Date('2026-10-28T10:00:00.000Z'),
      updatedAt: NOW,
      deletedAt: null,
    };
    expect(planToWire(row)).toMatchObject({ minimum: 1, startAmount: 1, restartedOn: '2026-10-28' });
  });
});
