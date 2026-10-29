import { FRESH_START_KINDS, MUHASABA_QUESTIONS, type FreshStartKind, type MuhasabaQuestion } from '@thekra/practice-core';
import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
import { UUID, Fields, asList, asMap } from './practice-catalog.js';
import { parseYaml, type YamlValue } from './practice-yaml.js';

/**
 * The tazkiya prompts (prisma/taxonomy/tazkiya-prompts.yaml), served as `tazkiya` in GET /v1/practice/catalog:
 * the morning intention, the evening reckoning's questions, the fresh-start cards and the supplications shown after a
 * tick (docs/plan/2026-10-tazkiya-tracker-proposals.md items 5–7). A reviewer file like the rest of the catalog,
 * embedded in the Vercel bundle (taxonomy-files.ts).
 *
 * Validated as a whole: unknown fields fail, every text has Arabic and English, the question keys are exactly
 * practice-core MUHASABA_QUESTIONS in order, the occasion kinds exactly FRESH_START_KINDS, evidence ids are UUIDs,
 * and the supplication lists pair up. A file that fails throws, and the unit test fails in CI before it ships.
 */
export interface MuhasabaQuestionText {
  key: MuhasabaQuestion;
  textAr: string;
  textEn: string;
}

export interface FreshStartText {
  kind: FreshStartKind;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  evidence?: string[];
}

export interface TazkiyaPrompts {
  review: string;
  niyyah: { introAr: string; introEn: string };
  muhasaba: {
    introAr: string;
    introEn: string;
    questions: MuhasabaQuestionText[];
    thanksAr: string;
    thanksEn: string;
  };
  freshStarts: {
    renewAr: string;
    renewEn: string;
    increaseAr: string;
    increaseEn: string;
    startAr: string;
    startEn: string;
    occasions: FreshStartText[];
  };
  celebrations: { linesAr: string[]; linesEn: string[] };
}

const FILE = 'tazkiya-prompts.yaml';

function readQuestion(value: YamlValue, where: string): MuhasabaQuestionText {
  const f = new Fields(asMap(value, where), where, ['key', 'textAr', 'textEn']);
  return { key: f.oneOf('key', MUHASABA_QUESTIONS), textAr: f.string('textAr'), textEn: f.string('textEn') };
}

function readFreshStart(value: YamlValue, where: string): FreshStartText {
  const f = new Fields(asMap(value, where), where, ['kind', 'titleAr', 'titleEn', 'bodyAr', 'bodyEn', 'evidence']);
  const evidence = f.optionalStrings('evidence', UUID);
  return {
    kind: f.oneOf('kind', FRESH_START_KINDS),
    titleAr: f.string('titleAr'),
    titleEn: f.string('titleEn'),
    bodyAr: f.string('bodyAr'),
    bodyEn: f.string('bodyEn'),
    ...(evidence ? { evidence } : {}),
  };
}

function readMuhasaba(f: Fields, where: string): TazkiyaPrompts['muhasaba'] {
  const m = new Fields(f.mapping('muhasaba'), where, ['introAr', 'introEn', 'questions', 'thanksAr', 'thanksEn']);
  const questions = asList(f.mapping('muhasaba')['questions'], `${where}.questions`).map((item, index) =>
    readQuestion(item, `${where}.questions[${index}]`),
  );
  const keys = questions.map((q) => q.key).join(',');
  if (keys !== MUHASABA_QUESTIONS.join(',')) m.fail(`questions must be ${MUHASABA_QUESTIONS.join(', ')} in this order (got ${keys})`);
  return {
    introAr: m.string('introAr'),
    introEn: m.string('introEn'),
    questions,
    thanksAr: m.string('thanksAr'),
    thanksEn: m.string('thanksEn'),
  };
}

function readFreshStarts(f: Fields, where: string): TazkiyaPrompts['freshStarts'] {
  const map = f.mapping('freshStarts');
  const s = new Fields(map, where, ['renewAr', 'renewEn', 'increaseAr', 'increaseEn', 'startAr', 'startEn', 'occasions']);
  const occasions = asList(map['occasions'], `${where}.occasions`).map((item, index) =>
    readFreshStart(item, `${where}.occasions[${index}]`),
  );
  const kinds = occasions.map((o) => o.kind);
  const missing = FRESH_START_KINDS.find((kind) => !kinds.includes(kind));
  if (missing) s.fail(`occasions: "${missing}" is missing`);
  if (new Set(kinds).size !== kinds.length) s.fail('occasions: a kind appears twice');
  return {
    renewAr: s.string('renewAr'),
    renewEn: s.string('renewEn'),
    increaseAr: s.string('increaseAr'),
    increaseEn: s.string('increaseEn'),
    startAr: s.string('startAr'),
    startEn: s.string('startEn'),
    occasions,
  };
}

/** Parses and validates the file. Throws a message naming the file and entry on any problem. */
export function buildTazkiyaPrompts(text: string): TazkiyaPrompts {
  const top = new Fields(asMap(parseYaml(text, FILE), FILE), FILE, ['review', 'niyyah', 'muhasaba', 'freshStarts', 'celebrations']);
  const niyyah = new Fields(top.mapping('niyyah'), `${FILE} niyyah`, ['introAr', 'introEn']);
  const celebrations = new Fields(top.mapping('celebrations'), `${FILE} celebrations`, ['linesAr', 'linesEn']);
  const linesAr = celebrations.strings('linesAr');
  const linesEn = celebrations.strings('linesEn');
  if (linesAr.length !== linesEn.length) celebrations.fail(`linesAr has ${linesAr.length} lines but linesEn has ${linesEn.length}`);
  return {
    review: top.string('review'),
    niyyah: { introAr: niyyah.string('introAr'), introEn: niyyah.string('introEn') },
    muhasaba: readMuhasaba(top, `${FILE} muhasaba`),
    freshStarts: readFreshStarts(top, `${FILE} freshStarts`),
    celebrations: { linesAr, linesEn },
  };
}

let cached: TazkiyaPrompts | null = null;

/** The validated prompts from the embedded reviewer file (cached after the first call). */
export function tazkiyaPrompts(): TazkiyaPrompts {
  cached ??= buildTazkiyaPrompts(readTaxonomyFile(FILE));
  return cached;
}
