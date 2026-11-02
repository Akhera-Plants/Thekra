import { STORY_MOMENTS } from '@thekra/practice-core';
import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
import { topicSide } from '../taxonomy/topic-pairs.js';
import { parseYaml, type YamlMap } from './practice-yaml.js';

/**
 * prisma/taxonomy/heart-texts.yaml (redesign §4.5): curated «الميزان» ids per topic and the story id of each moment.
 * Validated as a whole when first read: known topic keys (taxonomy.yaml slugs or `branch-1…77`), at most two UUIDs per
 * topic, story keys exactly practice-core `STORY_MOMENTS`, story values a UUID or empty, and the «لحظة مجاهدة» lists
 * (`mujahadaVerses`, `mujahadaSayings`, `multiplierHadith`, `sittingPrayerHadith`, `easyHighReward`). A bad file throws, and the
 * unit test that loads the real file fails in CI before it can ship.
 */
export interface HeartTexts {
  review: string;
  /** Topic key → 1–2 Quote ids. */
  mizan: Record<string, string[]>;
  /** Story key → Quote id, or null while not found. */
  stories: Record<string, string | null>;
  /** «لحظة مجاهدة» texts (2026-11-01). */
  mujahada: MujahadaTexts;
}

/**
 * «لحظة مجاهدة» (formerly «لحظة ضعف»), served in the practice catalog as `mujahada`. Every id is a public Quote id; the
 * client reads the text by id. Empty lists / null values: nothing to show (the screen hides that part).
 */
export interface MujahadaTexts {
  /** Quran passages on patience, steadfastness and striving: each passage is 1–3 consecutive verse ids shown together. */
  verses: string[][];
  /** Sayings of the scholars on patience and resisting desire (published quotes only). Empty while none qualifies. */
  sayings: string[];
  /** The sahih hadith: a good deed is written ten times up to seven hundred times. */
  multiplierHadith: string | null;
  /** The sahih hadith: the (voluntary) prayer sitting has half the reward of standing. */
  sittingPrayerHadith: string | null;
  /** Good-deed topic slugs (taxonomy.yaml, side DO) for «أتبِع السيئةَ الحسنة»: easy deeds with a great reward. */
  easyHighReward: string[];
}

const FILE = 'heart-texts.yaml';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRANCH_KEY = /^branch-(\d+)$/;
export const MIZAN_MAX = 2;
export const MUJAHADA_VERSES_MAX = 15;
export const MUJAHADA_PASSAGE_MAX = 3;
export const MUJAHADA_SAYINGS_MAX = 10;
export const EASY_HIGH_REWARD_MAX = 10;
const TOP_LEVEL = ['review', 'mizan', 'stories', 'mujahadaVerses', 'mujahadaSayings', 'multiplierHadith', 'sittingPrayerHadith', 'easyHighReward'];
export const BRANCH_MAX = 77;

function fail(message: string): never {
  throw new Error(`${FILE}: ${message}`);
}

function isMap(value: unknown): value is YamlMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for a taxonomy.yaml sin / deed slug or `branch-<n>` with n in 1…77. */
export function isMizanKey(key: string): boolean {
  const branch = BRANCH_KEY.exec(key);
  if (branch) {
    const n = Number(branch[1]);
    return n >= 1 && n <= BRANCH_MAX;
  }
  return topicSide(key) !== null;
}

export function buildHeartTexts(text: string): HeartTexts {
  const root = parseYaml(text, FILE);
  if (!isMap(root)) fail('expected a mapping');
  const unknown = Object.keys(root).find((key) => !TOP_LEVEL.includes(key));
  if (unknown) fail(`unknown field "${unknown}"`);
  if (typeof root['review'] !== 'string' || !root['review']) fail('review must be a non-empty string');

  const mizanRaw = root['mizan'] ?? {};
  if (!isMap(mizanRaw)) fail('mizan must be a mapping');
  const mizan: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(mizanRaw)) {
    if (!isMizanKey(key)) fail(`mizan "${key}" is not a taxonomy.yaml topic or branch-1…${BRANCH_MAX}`);
    if (!Array.isArray(value) || value.length === 0 || value.length > MIZAN_MAX) {
      fail(`mizan "${key}" must list 1 to ${MIZAN_MAX} Quote ids`);
    }
    const ids = value.map((id) => (typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : fail(`mizan "${key}": "${String(id)}" is not a UUID`)));
    if (new Set(ids).size !== ids.length) fail(`mizan "${key}" lists an id twice`);
    mizan[key] = ids;
  }

  const storiesRaw = root['stories'];
  if (!isMap(storiesRaw)) fail('stories must be a mapping');
  const expected = Object.values(STORY_MOMENTS) as string[];
  const keys = Object.keys(storiesRaw);
  const extra = keys.find((key) => !expected.includes(key));
  if (extra) fail(`stories "${extra}" is not a practice-core story key (${expected.join(', ')})`);
  const missing = expected.find((key) => !keys.includes(key));
  if (missing) fail(`stories "${missing}" is missing (leave it empty until its id is known)`);
  const stories: Record<string, string | null> = {};
  for (const key of expected) {
    const value = storiesRaw[key];
    if (value === null || value === '') stories[key] = null;
    else if (typeof value === 'string' && UUID.test(value)) stories[key] = value.toLowerCase();
    else fail(`stories "${key}": "${String(value)}" is not a UUID or empty`);
  }

  return { review: root['review'], mizan, stories, mujahada: readMujahada(root) };
}

function uuidOf(value: unknown, where: string): string {
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : fail(`${where}: "${String(value)}" is not a UUID`);
}

function optionalUuid(value: unknown, where: string): string | null {
  return value === null || value === undefined || value === '' ? null : uuidOf(value, where);
}

function listOf(value: unknown, where: string, max: number): unknown[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) fail(`${where} must be a list`);
  if (value.length > max) fail(`${where} must list at most ${max} entries`);
  return value;
}

/** The «لحظة مجاهدة» part: every id a UUID and used once; topic slugs are taxonomy.yaml good deeds. */
function readMujahada(root: YamlMap): MujahadaTexts {
  const verses = listOf(root['mujahadaVerses'], 'mujahadaVerses', MUJAHADA_VERSES_MAX).map((entry, index) => {
    const where = `mujahadaVerses[${index}]`;
    const ids = Array.isArray(entry) ? entry : [entry];
    if (ids.length === 0 || ids.length > MUJAHADA_PASSAGE_MAX) fail(`${where} must hold 1 to ${MUJAHADA_PASSAGE_MAX} verse ids`);
    return ids.map((id) => uuidOf(id, where));
  });
  const sayings = listOf(root['mujahadaSayings'], 'mujahadaSayings', MUJAHADA_SAYINGS_MAX).map((id, index) => uuidOf(id, `mujahadaSayings[${index}]`));
  const multiplierHadith = optionalUuid(root['multiplierHadith'], 'multiplierHadith');
  const sittingPrayerHadith = optionalUuid(root['sittingPrayerHadith'], 'sittingPrayerHadith');
  const all = [...verses.flat(), ...sayings, ...[multiplierHadith, sittingPrayerHadith].filter((id): id is string => id !== null)];
  const twice = all.find((id, index) => all.indexOf(id) !== index);
  if (twice) fail(`the «لحظة مجاهدة» lists use ${twice} twice`);
  const easyHighReward = listOf(root['easyHighReward'], 'easyHighReward', EASY_HIGH_REWARD_MAX).map((slug, index) => {
    if (typeof slug !== 'string' || topicSide(slug) !== 'DO') fail(`easyHighReward[${index}]: "${String(slug)}" is not a taxonomy.yaml good deed`);
    return slug;
  });
  if (new Set(easyHighReward).size !== easyHighReward.length) fail('easyHighReward lists a topic twice');
  return { verses, sayings, multiplierHadith, sittingPrayerHadith, easyHighReward };
}

let cached: HeartTexts | null = null;

export function heartTexts(): HeartTexts {
  cached ??= buildHeartTexts(readTaxonomyFile(FILE));
  return cached;
}

/** Curated «الميزان» ids of a sin / deed slug or a branch number (empty when none). */
export function mizanIdsFor(topic: string | number): string[] {
  const key = typeof topic === 'number' ? `branch-${topic}` : topic;
  return heartTexts().mizan[key] ?? [];
}
