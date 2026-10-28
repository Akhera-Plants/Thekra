import {
  isValidTime,
  STAGE_MIN_DAYS,
  stagesFor,
  validateRule,
  type PlanUnit,
  type Rule,
  type SinCategory,
  type Stage,
} from '@thekra/practice-core';
import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
import { topicSide } from '../taxonomy/topic-pairs.js';
import { parseYaml, type YamlMap, type YamlValue } from './practice-yaml.js';

/**
 * The practice catalog: sunnah occasions and habit units
 * (prisma/taxonomy/deed-schedules.yaml) and the sin-leaving programs
 * (prisma/taxonomy/sin-programs.yaml). Both are reviewer files, embedded in the
 * Vercel bundle like the other taxonomy files (taxonomy-files.ts).
 *
 * Loaded once and validated as a whole: every rule passes practice-core
 * `validateRule`, every deed / sin slug is a taxonomy.yaml topic on the right
 * side, evidence ids are UUIDs, haqq_ibad programs never allow a gradual path
 * (roadmap §4.1, owner decision D1), and paired Arabic / English lists have the
 * same length. A file that fails throws, and the unit test that loads the real
 * files fails in CI before it can ship.
 */
export type Basis = 'text' | 'organizational';

export interface Occasion {
  key: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  rule: Rule;
  basis: Basis;
  evidence: string[];
}

export interface Habit {
  key: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  unit: PlanUnit;
  unitLabelAr: string;
  unitLabelEn: string;
  start: { far: number; near: number };
  ceiling?: number;
  defaultRule: Rule;
  timeHintAr?: string;
  timeHintEn?: string;
  defaultSlots: string[];
  basis: Basis;
  evidence: string[];
}

export interface ProgramText {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  lines?: number[];
  evidence?: string[];
}

export interface SinProgramsCommon {
  willQuestionAr: string;
  willQuestionEn: string;
  stageMinDays: number;
  stages: Record<Stage, ProgramText>;
  afterFall: ProgramText;
  helpAr: string;
  helpEn: string;
}

export interface SinProgramEntry {
  sin: string;
  category: SinCategory;
  gradualAllowed: boolean;
  help: boolean;
  gradualStepsAr?: string[];
  gradualStepsEn?: string[];
  actionsAr: string[];
  actionsEn: string[];
  /** Habit keys suggested in the «alternatives» stage. */
  alternatives: string[];
  evidence: string[];
  lines?: number[];
}

export interface SinProgramsCatalog {
  review: string;
  common: SinProgramsCommon;
  programs: SinProgramEntry[];
}

export interface PracticeCatalog {
  occasions: Occasion[];
  habits: Habit[];
  sinPrograms: SinProgramsCatalog;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASES: readonly Basis[] = ['text', 'organizational'];
const UNITS: readonly PlanUnit[] = ['times', 'count', 'minutes'];
const CATEGORIES: readonly SinCategory[] = ['haqq_allah', 'haqq_ibad'];
const ALL_STAGES: readonly Stage[] = [...new Set([...stagesFor('haqq_allah'), ...stagesFor('haqq_ibad')])];

/** Unknown fields are an error: a typo must not pass silently. */
function assertKnownFields(map: YamlMap, where: string, allowed: readonly string[]): void {
  const unknown = Object.keys(map).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`${where}: unknown field "${unknown}"`);
}

/** Typed reads of one YAML mapping. */
class Fields {
  constructor(
    private readonly map: YamlMap,
    private readonly where: string,
    allowed: readonly string[],
  ) {
    assertKnownFields(map, where, allowed);
  }

  fail(message: string): never {
    throw new Error(`${this.where}: ${message}`);
  }

  private has(key: string): boolean {
    return this.map[key] !== undefined && this.map[key] !== null;
  }

  string(key: string): string {
    const value = this.map[key];
    if (typeof value !== 'string' || value.trim() === '') this.fail(`${key} must be a non-empty string`);
    return value;
  }

  optionalString(key: string): string | undefined {
    return this.has(key) ? this.string(key) : undefined;
  }

  integer(key: string, min: number): number {
    const value = this.map[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) this.fail(`${key} must be an integer ≥ ${min}`);
    return value;
  }

  optionalInteger(key: string, min: number): number | undefined {
    return this.has(key) ? this.integer(key, min) : undefined;
  }

  boolean(key: string): boolean {
    const value = this.map[key];
    if (typeof value !== 'boolean') this.fail(`${key} must be true or false`);
    return value;
  }

  oneOf<T extends string>(key: string, values: readonly T[]): T {
    const value = this.string(key);
    if (!(values as readonly string[]).includes(value)) this.fail(`${key} must be one of ${values.join(', ')}`);
    return value as T;
  }

  strings(key: string, pattern?: RegExp): string[] {
    const value = this.map[key];
    if (!Array.isArray(value) || value.length === 0) this.fail(`${key} must be a non-empty list`);
    return value.map((item, index) => {
      if (typeof item !== 'string' || item.trim() === '') this.fail(`${key}[${index}] must be a non-empty string`);
      if (pattern && !pattern.test(item)) this.fail(`${key}[${index}] "${item}" is not valid`);
      return item;
    });
  }

  optionalStrings(key: string, pattern?: RegExp): string[] | undefined {
    return this.has(key) ? this.strings(key, pattern) : undefined;
  }

  optionalIntegers(key: string): number[] | undefined {
    if (!this.has(key)) return undefined;
    const value = this.map[key];
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'number' && Number.isInteger(item) && item > 0)) {
      this.fail(`${key} must be a list of positive integers`);
    }
    return value as number[];
  }

  rule(key: string): Rule {
    const value = this.map[key];
    const error = validateRule(value);
    if (error) this.fail(`${key}: ${error}`);
    return value as unknown as Rule;
  }

  mapping(key: string): YamlMap {
    return asMap(this.map[key], `${this.where}.${key}`);
  }
}

function asMap(value: YamlValue | undefined, where: string): YamlMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${where}: expected a mapping`);
  return value;
}

function asList(value: YamlValue | undefined, where: string): YamlValue[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${where}: expected a non-empty list`);
  return value;
}

function assertTopic(fields: Fields, slug: string, side: 'AVOID' | 'DO'): void {
  const found = topicSide(slug);
  if (found !== side) {
    fields.fail(`"${slug}" is ${found ? `a topic with side ${found}` : 'not a topic'} in taxonomy.yaml; expected side ${side}`);
  }
}

function assertSameLength(fields: Fields, ar: string[] | undefined, en: string[] | undefined, key: string): void {
  if ((ar === undefined) !== (en === undefined)) fields.fail(`${key}Ar and ${key}En must both be present or both absent`);
  if (ar && en && ar.length !== en.length) {
    fields.fail(`${key}Ar has ${ar.length} items but ${key}En has ${en.length} (quote an English item that contains a comma)`);
  }
}

function assertUniqueKeys(items: readonly { key: string }[], where: string): void {
  const seen = new Set<string>();
  for (const { key } of items) {
    if (seen.has(key)) throw new Error(`${where}: duplicate key "${key}"`);
    seen.add(key);
  }
}

function readOccasion(value: YamlValue, where: string): Occasion {
  const f = new Fields(asMap(value, where), where, ['key', 'titleAr', 'titleEn', 'deed', 'rule', 'basis', 'evidence']);
  const occasion: Occasion = {
    key: f.string('key'),
    titleAr: f.string('titleAr'),
    titleEn: f.string('titleEn'),
    deed: f.string('deed'),
    rule: f.rule('rule'),
    basis: f.oneOf('basis', BASES),
    evidence: f.strings('evidence', UUID),
  };
  if (!KEY.test(occasion.key)) f.fail(`key "${occasion.key}" must be kebab-case`);
  assertTopic(f, occasion.deed, 'DO');
  return occasion;
}

const HABIT_FIELDS = [
  'key', 'titleAr', 'titleEn', 'deed', 'unit', 'unitLabelAr', 'unitLabelEn', 'start', 'ceiling', 'defaultRule',
  'timeHintAr', 'timeHintEn', 'defaultSlots', 'basis', 'evidence',
];

function readHabit(value: YamlValue, where: string): Habit {
  const f = new Fields(asMap(value, where), where, HABIT_FIELDS);
  const start = new Fields(f.mapping('start'), `${where}.start`, ['far', 'near']);
  const ceiling = f.optionalInteger('ceiling', 1);
  const timeHintAr = f.optionalString('timeHintAr');
  const timeHintEn = f.optionalString('timeHintEn');
  if ((timeHintAr === undefined) !== (timeHintEn === undefined)) f.fail('timeHintAr and timeHintEn go together');
  // Built in the file's field order; optional fields only when present.
  const habit: Habit = {
    key: f.string('key'),
    titleAr: f.string('titleAr'),
    titleEn: f.string('titleEn'),
    deed: f.string('deed'),
    unit: f.oneOf('unit', UNITS),
    unitLabelAr: f.string('unitLabelAr'),
    unitLabelEn: f.string('unitLabelEn'),
    start: { far: start.integer('far', 1), near: start.integer('near', 1) },
    ...(ceiling !== undefined ? { ceiling } : {}),
    defaultRule: f.rule('defaultRule'),
    ...(timeHintAr !== undefined && timeHintEn !== undefined ? { timeHintAr, timeHintEn } : {}),
    defaultSlots: f.strings('defaultSlots'),
    basis: f.oneOf('basis', BASES),
    evidence: f.strings('evidence', UUID),
  };
  if (!KEY.test(habit.key)) f.fail(`key "${habit.key}" must be kebab-case`);
  if (habit.start.far > habit.start.near) f.fail('start.far must be ≤ start.near');
  if (ceiling !== undefined && ceiling < habit.start.near) f.fail('ceiling must be ≥ start.near');
  const badSlot = habit.defaultSlots.findIndex((slot) => !isValidTime(slot));
  if (badSlot >= 0) f.fail(`defaultSlots[${badSlot}] must be HH:MM`);
  assertTopic(f, habit.deed, 'DO');
  return habit;
}

function readProgramText(value: YamlValue | undefined, where: string): ProgramText {
  const f = new Fields(asMap(value, where), where, ['titleAr', 'titleEn', 'bodyAr', 'bodyEn', 'lines', 'evidence']);
  const text: ProgramText = {
    titleAr: f.string('titleAr'),
    titleEn: f.string('titleEn'),
    bodyAr: f.string('bodyAr'),
    bodyEn: f.string('bodyEn'),
  };
  const lines = f.optionalIntegers('lines');
  const evidence = f.optionalStrings('evidence', UUID);
  if (lines) text.lines = lines;
  if (evidence) text.evidence = evidence;
  return text;
}

function readCommon(value: YamlValue | undefined, where: string): SinProgramsCommon {
  const f = new Fields(asMap(value, where), where, [
    'willQuestionAr', 'willQuestionEn', 'stageMinDays', 'stages', 'afterFall', 'helpAr', 'helpEn',
  ]);
  const stagesMap = f.mapping('stages');
  assertKnownFields(stagesMap, `${where}.stages`, ALL_STAGES);
  const missing = ALL_STAGES.find((stage) => !Object.hasOwn(stagesMap, stage));
  if (missing) f.fail(`stages.${missing} is missing`);
  const stages = Object.fromEntries(
    Object.keys(stagesMap).map((stage) => [stage, readProgramText(stagesMap[stage], `${where}.stages.${stage}`)]),
  ) as Record<Stage, ProgramText>;
  const common: SinProgramsCommon = {
    willQuestionAr: f.string('willQuestionAr'),
    willQuestionEn: f.string('willQuestionEn'),
    stageMinDays: f.integer('stageMinDays', 1),
    stages,
    afterFall: readProgramText(f.mapping('afterFall'), `${where}.afterFall`),
    helpAr: f.string('helpAr'),
    helpEn: f.string('helpEn'),
  };
  if (common.stageMinDays !== STAGE_MIN_DAYS) {
    f.fail(`stageMinDays ${common.stageMinDays} differs from practice-core STAGE_MIN_DAYS ${STAGE_MIN_DAYS}`);
  }
  return common;
}

const PROGRAM_FIELDS = [
  'sin', 'category', 'gradualAllowed', 'help', 'gradualStepsAr', 'gradualStepsEn', 'actionsAr', 'actionsEn',
  'alternatives', 'evidence', 'lines',
];

function readProgram(value: YamlValue, where: string, habitKeys: ReadonlySet<string>): SinProgramEntry {
  const f = new Fields(asMap(value, where), where, PROGRAM_FIELDS);
  const gradualStepsAr = f.optionalStrings('gradualStepsAr');
  const gradualStepsEn = f.optionalStrings('gradualStepsEn');
  const lines = f.optionalIntegers('lines');
  const program: SinProgramEntry = {
    sin: f.string('sin'),
    category: f.oneOf('category', CATEGORIES),
    gradualAllowed: f.boolean('gradualAllowed'),
    help: f.boolean('help'),
    ...(gradualStepsAr && gradualStepsEn ? { gradualStepsAr, gradualStepsEn } : {}),
    actionsAr: f.strings('actionsAr'),
    actionsEn: f.strings('actionsEn'),
    alternatives: f.strings('alternatives'),
    evidence: f.strings('evidence', UUID),
    ...(lines ? { lines } : {}),
  };
  assertTopic(f, program.sin, 'AVOID');
  if (program.category === 'haqq_ibad' && program.gradualAllowed) {
    f.fail('a haqq_ibad program must have gradualAllowed: false (roadmap §4.1)');
  }
  if (gradualStepsAr && !program.gradualAllowed) f.fail('gradualSteps need gradualAllowed: true');
  assertSameLength(f, gradualStepsAr, gradualStepsEn, 'gradualSteps');
  assertSameLength(f, program.actionsAr, program.actionsEn, 'actions');
  const unknown = program.alternatives.find((key) => !habitKeys.has(key));
  if (unknown) f.fail(`alternative "${unknown}" is not a habit key in deed-schedules.yaml`);
  return program;
}

/** Parses and validates both files. Throws a message naming the file and entry on any problem. */
export function buildPracticeCatalog(schedulesText: string, programsText: string): PracticeCatalog {
  const schedules = asMap(parseYaml(schedulesText, 'deed-schedules.yaml'), 'deed-schedules.yaml');
  assertKnownFields(schedules, 'deed-schedules.yaml', ['occasions', 'habits']);
  const occasions = asList(schedules['occasions'], 'deed-schedules.yaml occasions').map((item, index) =>
    readOccasion(item, `deed-schedules.yaml occasions[${index}]`),
  );
  const habits = asList(schedules['habits'], 'deed-schedules.yaml habits').map((item, index) =>
    readHabit(item, `deed-schedules.yaml habits[${index}]`),
  );
  assertUniqueKeys(occasions, 'deed-schedules.yaml occasions');
  assertUniqueKeys(habits, 'deed-schedules.yaml habits');

  const programsFile = asMap(parseYaml(programsText, 'sin-programs.yaml'), 'sin-programs.yaml');
  const top = new Fields(programsFile, 'sin-programs.yaml', ['review', 'common', 'programs']);
  const habitKeys = new Set(habits.map((habit) => habit.key));
  const programs = asList(programsFile['programs'], 'sin-programs.yaml programs').map((item, index) =>
    readProgram(item, `sin-programs.yaml programs[${index}]`, habitKeys),
  );
  assertUniqueKeys(programs.map((program) => ({ key: program.sin })), 'sin-programs.yaml programs');

  return {
    occasions,
    habits,
    sinPrograms: {
      review: top.string('review'),
      common: readCommon(programsFile['common'], 'sin-programs.yaml common'),
      programs,
    },
  };
}

let cached: PracticeCatalog | null = null;

/** The validated catalog from the embedded reviewer files (cached after the first call). */
export function practiceCatalog(): PracticeCatalog {
  cached ??= buildPracticeCatalog(readTaxonomyFile('deed-schedules.yaml'), readTaxonomyFile('sin-programs.yaml'));
  return cached;
}

/** Habits and occasions that lead to one good deed's page. */
export function scheduleForDeed(slug: string): { habits: Habit[]; occasions: Occasion[] } {
  const { habits, occasions } = practiceCatalog();
  return {
    habits: habits.filter((habit) => habit.deed === slug),
    occasions: occasions.filter((occasion) => occasion.deed === slug),
  };
}

/** Whether a sin has a leaving program, and its category. Nothing else about the program is exposed here. */
export function programForSin(slug: string): { available: boolean; category: SinCategory | null } {
  const program = practiceCatalog().sinPrograms.programs.find((entry) => entry.sin === slug);
  return program ? { available: true, category: program.category } : { available: false, category: null };
}
