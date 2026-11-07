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
    // The templates added on 2026-10-31 reuse ids already used (and verified) elsewhere in the file,
    const before = new Set(['sadaqah-weekly', 'silat-ar-rahim']);
    const known = new Set(
      [...practiceCatalog().occasions, ...practiceCatalog().habits.filter((h) => h.kind !== 'periodic' || before.has(h.key))].flatMap(
        (x) => x.evidence,
      ),
    );
    // …or ids checked against production and marked so on their line (`# checked: <date> …`).
    const checked = new Set([...schedulesText.matchAll(/\[([0-9a-f-]{36})\] # checked: /g)].map((m) => m[1]));
    for (const h of periodic.filter((x) => !before.has(x.key))) {
      for (const id of h.evidence) expect(known.has(id) || checked.has(id), `${h.key} ${id}`).toBe(true);
    }
  });

  it('maps each habit deed to its branches of faith (taxonomy.yaml) and carries the story ids (heart-texts.yaml)', () => {
    const { deedBranches, stories } = practiceCatalog();
    const deeds = new Set(practiceCatalog().habits.map((h) => h.deed));
    for (const [deed, branches] of Object.entries(deedBranches)) {
      expect(deeds.has(deed), deed).toBe(true);
      expect(branches.length).toBeGreaterThan(0);
      for (const n of branches) expect(n >= 1 && n <= 77, `${deed} ${n}`).toBe(true);
    }
    expect(Object.keys(stories).sort()).toEqual(['fasila', 'ghusn-shawk', 'marad-safar', 'qatil-al-mia']);
  });

  it('carries the «لحظة مجاهدة» lists (heart-texts.yaml)', () => {
    const { mujahada } = practiceCatalog();
    expect(Object.keys(mujahada)).toEqual(['verses', 'sayings', 'multiplierHadith', 'sittingPrayerHadith', 'easyHighReward']);
    expect(mujahada.verses.length).toBeGreaterThanOrEqual(8);
    expect(mujahada.verses.length).toBeLessThanOrEqual(15);
    expect(mujahada.verses.every((passage) => passage.length >= 1 && passage.length <= 3)).toBe(true);
    expect(mujahada.sayings).toEqual([]);
    expect(mujahada.multiplierHadith).toBe('f8ee2864-b801-432d-9644-b05b99db34b0');
    expect(mujahada.sittingPrayerHadith).toBe('e9026ac0-00d6-4c6d-bb03-9fbed245a740');
    expect(mujahada.easyHighReward).toContain('birr-al-walidayn');
    expect(mujahada.easyHighReward.length).toBeGreaterThanOrEqual(6);
  });

  it('every prayer habit has a time window; Duha is never after Dhuhr and offers no prayer anchor (owner, 2026-11-01)', () => {
    const byKey = new Map(practiceCatalog().habits.map((h) => [h.key, h]));
    expect(byKey.get('duha')?.window).toEqual({ from: 'sunrise', fromMinutes: 15, to: 'dhuhr', toMinutes: -10, anchors: [] });
    expect(byKey.get('witr')?.window?.anchors).toEqual(['after-isha', 'before-sleep']);
    expect(byKey.get('qiyam-last-third')?.window?.from).toBe('lastThird');
  });

  it('carries the «لحظة مجاهدة» acts per sin (F-09): AVOID topics, public-text ids, generic acts, no wudu for anger', () => {
    const { moment } = sinPrograms;
    expect(moment.generic.map((t) => t.key)).toEqual(['istiadha', 'allah-sees', 'leave-the-place', 'ask-allah']);
    expect(Object.keys(moment.sins).length).toBeGreaterThanOrEqual(14);
    for (const slug of [...Object.keys(moment.sins), ...Object.keys(moment.aliases)]) expect(topicSide(slug), slug).toBe('AVOID');
    for (const target of Object.values(moment.aliases)) expect(Object.keys(moment.sins)).toContain(target);
    // Every written program has acts of its own.
    for (const { sin } of sinPrograms.programs) expect(moment.sins[sin]?.length, sin).toBeGreaterThan(0);
    const tools = [...moment.generic, ...Object.values(moment.sins).flat()];
    for (const tool of tools) {
      expect(tool.titleAr && tool.titleEn, tool.key).toBeTruthy();
      expect(tool.evidence.length, tool.key).toBeGreaterThan(0);
      for (const id of tool.evidence) expect(id).toMatch(UUID);
    }
    expect(moment.sins['ghadab']!.map((t) => t.key)).toEqual(['istiadha', 'sit-lie-down', 'kazm', 'speak-good-or-silent']);
    // Abu Dawud 4784 is not public: neither an act nor a program step tells the angry to make wudu.
    expect(tools.some((t) => /وضوء|توضأ/.test(t.titleAr))).toBe(false);
    expect(sinPrograms.programs.find((p) => p.sin === 'ghadab')!.actionsAr.some((a) => /توضأ/.test(a))).toBe(false);
  });

  it('programForSin: written programs keep their category, every other sin is available with none', () => {
    expect(programForSin('ghibah')).toEqual({ available: true, category: 'haqq_ibad' });
    expect(programForSin('waqt-tawasul')).toEqual({ available: true, category: 'haqq_allah' });
    // Every sin can start the common program (owner, 2026-11-01); without a written one the visitor picks the category.
    expect(programForSin('shirk')).toEqual({ available: true, category: null });
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

  it('rejects a suggested time outside the deed window, and a bad window', () => {
    expect(build(schedulesText.replace("defaultSlots: ['09:30', '11:00']", "defaultSlots: ['09:30', '13:00']"))).toThrow(
      "13:00 is outside the deed's window",
    );
    expect(build(schedulesText.replace('      from: sunrise\n      fromMinutes: 15', '      from: noon\n      fromMinutes: 15'))).toThrow('window.from');
  });

  it('rejects a bad «لحظة مجاهدة» entry: a sin that is not an AVOID topic, a bad id, a duplicate key, a dangling alias', () => {
    expect(build(schedulesText, programsText.replace('\n    ghadab:\n      #', '\n    siyam:\n      #'))).toThrow('expected side AVOID');
    expect(build(schedulesText, programsText.replace('evidence: [558ee73d-0b03-4bf7-9629-8df391997463]', 'evidence: [nope]'))).toThrow('is not valid');
    expect(build(schedulesText, programsText.replace('- key: sit-lie-down', '- key: istiadha'))).toThrow('duplicate key "istiadha"');
    expect(build(schedulesText, programsText.replace('ghibah-raqamiya: ghibah', 'ghibah-raqamiya: hasad-x'))).toThrow('must name a sin listed under sins');
    expect(build(schedulesText, programsText.replace('        titleAr: "اجلس، فإن لم يذهب فاضطجع"\n', '        titleAr: "اجلس، فإن لم يذهب فاضطجع"\n        note: x\n'))).toThrow('unknown field "note"');
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
