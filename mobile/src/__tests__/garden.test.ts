/**
 * «بستاني»: growth stages from days tended (any amount counts), never lower for more days or for missed days, rest
 * during «يومي ثقيل», no plant for the sin program, and the tended line in both languages.
 */

import i18next from 'i18next';
import {
  addDays,
  correctLog,
  createPlan,
  createRelative,
  emptyStore,
  logContact,
  logDone,
  startEbb,
  startProgram,
  startSeason,
  type Plan,
  type Store,
} from '@thekra/practice-core';
import {
  GROWTH_THRESHOLDS,
  KINSHIP_PLANT_KEY,
  gardenPlants,
  growthStage,
  isResting,
  kinshipTendedDays,
  planTendedDays,
} from '../lib/practice/garden';
import ar from '../lib/i18n/ar.json';
import en from '../lib/i18n/en.json';

const T = '2026-10-01T10:00:00.000Z';
const START = '2026-10-01';

const plan = (id: string): Plan =>
  createPlan({ id, deedSlug: 'duha', title: 'الضحى', unit: 'count', amount: 2, activeDaysPerWeek: 4, slots: ['09:30'], createdOn: START }, T);

/** A plan with a small amount logged on each of `days` days, every other day from START. */
function tended(days: number, base: Plan = plan('p1')): Plan {
  let p = base;
  for (let i = 0; i < days; i++) p = logDone(p, addDays(START, i * 2), 1);
  return p;
}

const titleOf = (p: Plan) => p.title;

describe('growthStage', () => {
  it('starts as a seed and sprouts on the first day tended', () => {
    expect(growthStage(0)).toBe(0);
    expect(growthStage(1)).toBe(1);
  });

  it('reaches each stage exactly at its threshold', () => {
    GROWTH_THRESHOLDS.forEach((min, stage) => {
      expect(growthStage(min)).toBe(stage);
      if (min > 0) expect(growthStage(min - 1)).toBe(stage - 1);
    });
    expect(growthStage(10_000)).toBe(5);
  });

  it('never goes down as days are added', () => {
    let last = growthStage(0);
    for (let days = 1; days <= 200; days++) {
      const stage = growthStage(days);
      expect(stage).toBeGreaterThanOrEqual(last);
      last = stage;
    }
  });
});

describe('days tended', () => {
  it('counts days with any amount, however small, not the amount', () => {
    let p = plan('p1');
    p = logDone(p, '2026-10-01', 0.5);
    p = logDone(p, '2026-10-01', 3);
    p = logDone(p, '2026-10-04', 1);
    expect(planTendedDays(p, '2026-10-10')).toBe(2);
  });

  it('days need not follow each other, and missed days take nothing away', () => {
    const p = tended(21);
    const lastLogged = addDays(START, 40);
    const stageThen = growthStage(planTendedDays(p, lastLogged));
    expect(stageThen).toBe(3);
    for (const later of [addDays(lastLogged, 1), addDays(lastLogged, 30), addDays(lastLogged, 400)]) {
      expect(planTendedDays(p, later)).toBe(21);
      expect(growthStage(planTendedDays(p, later))).toBe(stageThen);
    }
  });

  it('does not count a day the user cleared as a mistake, nor days after today', () => {
    let p = logDone(plan('p1'), '2026-10-02', 1);
    p = correctLog(p, '2026-10-02', 0, T);
    p = logDone(p, '2026-10-20', 1);
    expect(planTendedDays(p, '2026-10-10')).toBe(0);
  });

  it('counts a kinship day once, however many relatives were reached', () => {
    const rule = { kind: 'everyNDays' as const, n: 7, anchor: START };
    const a = logContact(logContact(createRelative({ id: 'r1', name: 'خالتي', relation: '', rule }, T), '2026-10-03'), '2026-10-09');
    const b = logContact(createRelative({ id: 'r2', name: 'جدتي', relation: '', rule }, T), '2026-10-03');
    expect(kinshipTendedDays([a, b], '2026-10-31')).toBe(2);
  });
});

describe('rest («يومي ثقيل»)', () => {
  it('a plan in ebb rests at the stage it reached', () => {
    const grown = tended(40);
    const today = addDays(START, 90);
    const resting = startEbb(grown, today, T);
    expect(isResting(resting, today)).toBe(true);
    expect(isResting(resting, addDays(today, -1))).toBe(false);
    const [plant] = gardenPlants({ plans: [resting], relatives: [] }, addDays(today, 20), titleOf, 'صلة الرحم');
    expect(plant).toMatchObject({ stage: 4, tendedDays: 40, resting: true });
  });

  it('a season does not change the stage either', () => {
    const grown = tended(7);
    const today = addDays(START, 20);
    const before = gardenPlants({ plans: [grown], relatives: [] }, today, titleOf, '')[0];
    const after = gardenPlants({ plans: [startSeason(grown, 5, addDays(today, 30), T)], relatives: [] }, today, titleOf, '')[0];
    expect(after?.stage).toBe(before?.stage);
  });
});

describe('gardenPlants', () => {
  function store(): Store {
    const rule = { kind: 'everyNDays' as const, n: 7, anchor: START };
    return {
      ...emptyStore(),
      plans: [tended(1, plan('p1')), plan('p2')],
      relatives: [logContact(createRelative({ id: 'r1', name: 'خالتي', relation: '', rule }, T), '2026-10-05')],
      programs: [startProgram({ sinSlug: 'x', category: 'haqq_allah', hardToLeaveAtOnce: false, startedOn: START }, T)],
    };
  }

  it('grows one plant per plan, then one for صلة الرحم, and none for the sin program', () => {
    const plants = gardenPlants(store(), '2026-10-31', titleOf, 'صلة الرحم');
    expect(plants.map((p) => [p.key, p.kind, p.stage])).toEqual([
      ['p1', 'habit', 1],
      ['p2', 'habit', 0],
      [KINSHIP_PLANT_KEY, 'kinship', 1],
    ]);
    expect(plants[2]?.title).toBe('صلة الرحم');
    expect(JSON.stringify(plants)).not.toContain('"x"');
  });

  it('has no kinship plant without relatives, and nothing at all for an empty store', () => {
    expect(gardenPlants({ ...store(), relatives: [] }, '2026-10-31', titleOf, 'k').map((p) => p.kind)).toEqual(['habit', 'habit']);
    expect(gardenPlants(emptyStore(), '2026-10-31', titleOf, 'k')).toEqual([]);
  });
});

describe('garden strings', () => {
  const i18n = i18next.createInstance();

  beforeAll(async () => {
    await i18n.init({
      resources: { ar: { translation: ar }, en: { translation: en } },
      lng: 'ar',
      fallbackLng: 'ar',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
  });

  it('says how many days a plant was tended with the right Arabic form', () => {
    const t = i18n.getFixedT('ar');
    expect(t('garden.tended', { count: 0 })).toBe('بذرة تنتظر يومها الأول');
    expect(t('garden.tended', { count: 1 })).toBe('سقيتها في يوم واحد');
    expect(t('garden.tended', { count: 2 })).toBe('سقيتها في يومين');
    expect(t('garden.tended', { count: 5 })).toBe('سقيتها في 5 أيام');
    expect(t('garden.tended', { count: 21 })).toBe('سقيتها في 21 يومًا');
    expect(t('garden.tended', { count: 100 })).toBe('سقيتها في 100 يوم');
  });

  it('says it in English', () => {
    const t = i18n.getFixedT('en');
    expect(t('garden.tended', { count: 1 })).toBe('Tended on 1 day');
    expect(t('garden.tended', { count: 12 })).toBe('Tended on 12 days');
  });

  it('names every stage in both languages', () => {
    for (const lng of ['ar', 'en'] as const) {
      const t = i18n.getFixedT(lng);
      GROWTH_THRESHOLDS.forEach((_, stage) => expect(t(`garden.stages.${stage}`)).not.toBe(`garden.stages.${stage}`));
    }
  });
});
