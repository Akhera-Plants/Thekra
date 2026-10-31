import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { MURAQABA_QUOTE_IDS, stagesFor, validateRule } from '@thekra/practice-core';
import { taxonomyFilePath } from '../taxonomy/taxonomy-files.js';
import { topicSide } from '../taxonomy/topic-pairs.js';
import { buildPracticeCatalog, practiceCatalog, programForSin, scheduleForDeed } from './practice-catalog.js';
import { parseYaml, type YamlMap } from './practice-yaml.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schedulesText = readFileSync(taxonomyFilePath('deed-schedules.yaml'), 'utf8');
const programsText = readFileSync(taxonomyFilePath('sin-programs.yaml'), 'utf8');

describe('practice catalog — the real reviewer files', () => {
  const cwd = process.cwd();
  // The files resolve from the module (and are embedded in the bundle), never from process.cwd().
  beforeAll(() => process.chdir(tmpdir()));
  afterAll(() => process.chdir(cwd));

  const catalog = practiceCatalog();
  const { occasions, habits, sinPrograms } = catalog;

  it('loads occasions, habits and programs', () => {
    expect(occasions.map((o) => o.key)).toEqual(
      expect.arrayContaining(['ayyam-bid', 'ithnayn-khamis', 'arafah', 'ashura', 'shawwal-six', 'jumua']),
    );
    expect(habits.length).toBeGreaterThan(5);
    expect(sinPrograms.programs.length).toBeGreaterThan(0);
    expect(sinPrograms.review).toBe('pending-sheikh');
  });

  it('every rule passes practice-core validateRule', () => {
    for (const rule of [...occasions.map((o) => o.rule), ...habits.map((h) => h.defaultRule)]) {
      expect(validateRule(rule)).toBeNull();
    }
  });

  it('every deed is a DO topic and every sin an AVOID topic of taxonomy.yaml', () => {
    for (const deed of [...occasions, ...habits].map((item) => item.deed)) expect(topicSide(deed), deed).toBe('DO');
    for (const { sin } of sinPrograms.programs) expect(topicSide(sin), sin).toBe('AVOID');
  });

  it('every evidence id is a UUID', () => {
    const ids = [
      ...occasions.flatMap((o) => o.evidence),
      ...habits.flatMap((h) => h.evidence),
      ...sinPrograms.programs.flatMap((p) => p.evidence),
      ...Object.values(sinPrograms.common.stages).flatMap((stage) => stage.evidence ?? []),
      ...(sinPrograms.common.afterFall.evidence ?? []),
    ];
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it('haqq_ibad programs never allow a gradual path (owner decision D1)', () => {
    const ibad = sinPrograms.programs.filter((p) => p.category === 'haqq_ibad');
    expect(ibad.length).toBeGreaterThan(0);
    for (const program of ibad) expect(program.gradualAllowed).toBe(false);
  });

  it('has a text for every practice-core stage, Arabic and English lists of equal length', () => {
    for (const stage of [...stagesFor('haqq_allah'), ...stagesFor('haqq_ibad')]) {
      expect(sinPrograms.common.stages[stage].titleAr).toBeTruthy();
    }
    for (const program of sinPrograms.programs) {
      expect(program.actionsEn.length, program.sin).toBe(program.actionsAr.length);
    }
  });

  it('is exactly the parsed files: nothing renamed, added or dropped', () => {
    const schedules = parseYaml(schedulesText) as YamlMap;
    expect(JSON.parse(JSON.stringify(occasions))).toEqual(schedules['occasions']);
    expect(JSON.parse(JSON.stringify(habits))).toEqual(schedules['habits']);
    expect(JSON.parse(JSON.stringify(sinPrograms))).toEqual(parseYaml(programsText));
    expect(Object.keys(sinPrograms.common.stages)).toEqual(Object.keys((parseYaml(programsText) as { common: { stages: YamlMap } }).common.stages));
  });

  it('keeps the YAML field names and values as written (camelCase)', () => {
    expect(occasions.find((o) => o.key === 'arafah')).toEqual({
      key: 'arafah',
      titleAr: 'صيام يوم عرفة (9 ذو الحجة)',
      titleEn: 'Fasting the Day of Arafah (9 Dhu al-Hijja)',
      deed: 'siyam',
      rule: { kind: 'hijriYearly', month: 12, day: 9 },
      basis: 'text',
      evidence: ['0d77e977-f40b-473b-8b14-42b5fb82951a'],
    });
    expect(habits.find((h) => h.key === 'adhkar-sabah-masa')).toMatchObject({
      unit: 'count',
      start: { far: 10, near: 33 },
      ceiling: 100,
      defaultSlots: ['07:00', '18:00'],
    });
    expect(sinPrograms.common.stages.harms.bodyAr.startsWith('اقرأ ما ورد فيها من نصوص')).toBe(true);
  });

  it('scheduleForDeed filters by deed slug', () => {
    const siyam = scheduleForDeed('siyam');
    expect(siyam.occasions.map((o) => o.key)).toEqual(['ayyam-bid', 'ithnayn-khamis', 'arafah', 'ashura', 'shawwal-six']);
    expect(siyam.habits.map((h) => h.key)).toEqual(['siyam-ayyam-bid', 'siyam-ithnayn-khamis']);
    expect(scheduleForDeed('dhikr').habits.map((h) => h.key)).toEqual(['adhkar-sabah-masa', 'tasbih-after-salah']);
    expect(scheduleForDeed('no-such-deed')).toEqual({ habits: [], occasions: [] });
  });

  it('lists the «أعمال دورية» templates: people lists (one per circle) and dated acts; old habit keys stay', () => {
    const periodic = practiceCatalog().habits.filter((h) => h.kind === 'periodic');
    expect(periodic.map((h) => [h.key, h.people ?? null])).toEqual([
      ['sadaqah-weekly', null],
      ['silat-ar-rahim', 'kin'],
      ['birr-walidayn', 'parents'],
      ['tafaqqud-jiran', 'neighbors'],
      ['tafaqqud-sadiq', 'friends'],
      ['iyadat-marid', 'sick'],
      ['siyam-ayyam-bid', null],
      ['siyam-ithnayn-khamis', null],
      ['kahf-jumua', null],
      ['khatma', null],
      ['ziyarat-qubur', null],
    ]);
    expect(practiceCatalog().habits.find((h) => h.key === 'birr-call')?.kind).toBeUndefined();
    // The templates added on 2026-10-31 reuse only ids already used (and verified) elsewhere in the file, or none yet.
    const before = new Set(['sadaqah-weekly', 'silat-ar-rahim']);
    const known = new Set(
      [...practiceCatalog().occasions, ...practiceCatalog().habits.filter((h) => h.kind !== 'periodic' || before.has(h.key))].flatMap(
        (x) => x.evidence,
      ),
    );
    for (const h of periodic.filter((x) => !before.has(x.key))) {
      for (const id of h.evidence) expect(known.has(id), `${h.key} ${id}`).toBe(true);
    }
  });

  it('programForSin exposes only availability and category', () => {
    expect(programForSin('ghibah')).toEqual({ available: true, category: 'haqq_ibad' });
    expect(programForSin('waqt-tawasul')).toEqual({ available: true, category: 'haqq_allah' });
    expect(programForSin('shirk')).toEqual({ available: false, category: null });
  });
});

describe('practice catalog — validation failures', () => {
  const build = (schedules: string, programs = programsText) => () => buildPracticeCatalog(schedules, programs);

  it('rejects a gradual haqq_ibad program', () => {
    const text = programsText.replace(
      /(- sin: ghibah\n\s+category: haqq_ibad\n\s+gradualAllowed:) false/,
      '$1 true',
    );
    expect(text).not.toBe(programsText);
    expect(build(schedulesText, text)).toThrow('haqq_ibad program must have gradualAllowed: false');
  });

  it('rejects an invalid rule', () => {
    const text = schedulesText.replace('{ kind: hijriYearly, month: 12, day: 9 }', '{ kind: hijriYearly, month: 13, day: 9 }');
    expect(build(text)).toThrow('hijriYearly.month');
  });

  it('rejects a deed that is not a DO topic, and a sin that is not an AVOID topic', () => {
    expect(build(schedulesText.replace('deed: jumua', 'deed: ghibah'))).toThrow('"ghibah" is a topic with side AVOID');
    expect(build(schedulesText.replace('deed: jumua', 'deed: not-a-topic'))).toThrow('not a topic');
    expect(build(schedulesText, programsText.replace('sin: ghadab', 'sin: siyam'))).toThrow('expected side AVOID');
  });

  it('periodic templates: empty evidence allowed only for kind periodic; people needs periodic and a person rhythm', () => {
    const habitEmpty = schedulesText.replace('evidence: [f285c188-c4f1-472b-bd64-e249d479ed3d]', 'evidence: []');
    expect(habitEmpty).not.toBe(schedulesText);
    expect(build(habitEmpty)).toThrow('evidence must be a non-empty list');
    expect(build(schedulesText.replace('    kind: periodic\n    people: kin\n', '    people: kin\n'))).toThrow('people needs kind: periodic');
    expect(build(schedulesText.replace('people: neighbors', 'people: colleagues'))).toThrow('people must be one of');
    expect(build(schedulesText.replace('people: neighbors', 'people: kin'))).toThrow('two people templates for circle "kin"');
    expect(
      build(schedulesText.replace("defaultRule: { kind: everyNDays, n: 30, anchor: '2026-10-31' }", 'defaultRule: { kind: monthlyDay, day: 1 }')),
    ).toThrow("a person's rhythm");
  });

  it('rejects an evidence id that is not a UUID', () => {
    expect(build(schedulesText.replace('0d77e977-f40b-473b-8b14-42b5fb82951a]', 'not-a-uuid]'))).toThrow('is not valid');
  });

  it('rejects an unknown field and an English list that a comma split', () => {
    expect(build(schedulesText.replace('    basis: text\n', '    basis: text\n    note: x\n'))).toThrow('unknown field "note"');
    const split = programsText.replace("'When angry, fall silent and change your position'", 'When angry, fall silent and change your position');
    expect(build(schedulesText, split)).toThrow('actionsAr has 3 items but actionsEn has 4');
  });

  it('rejects an alternative that is not a habit key', () => {
    expect(build(schedulesText, programsText.replace('alternatives: [smile, adhkar-sabah-masa]', 'alternatives: [nope]'))).toThrow(
      'alternative "nope"',
    );
  });
});

describe('المراقبة texts (redesign §4.4)', () => {
  it('rotates only published ids already listed as evidence in the reviewed YAML files', () => {
    expect(MURAQABA_QUOTE_IDS.length).toBeGreaterThan(0);
    const evidence = [...practiceCatalog().habits.flatMap((h) => h.evidence), ...programsText.match(/[0-9a-f]{8}-[0-9a-f-]{27}/g)!];
    for (const id of MURAQABA_QUOTE_IDS) expect(evidence).toContain(id);
  });
});
