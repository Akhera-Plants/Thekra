import { STORY_MOMENTS } from '@thekra/practice-core';
import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';
import { topicSide } from '../taxonomy/topic-pairs.js';
import { parseYaml, type YamlMap } from './practice-yaml.js';

/**
 * prisma/taxonomy/heart-texts.yaml (redesign §4.5): curated «الميزان» ids per topic and the story id of each moment.
 * Validated as a whole when first read: known topic keys (taxonomy.yaml slugs or `branch-1…77`), at most two UUIDs per
 * topic, story keys exactly practice-core `STORY_MOMENTS`, story values a UUID or empty. A bad file throws, and the
 * unit test that loads the real file fails in CI before it can ship.
 */
export interface HeartTexts {
  review: string;
  /** Topic key → 1–2 Quote ids. */
  mizan: Record<string, string[]>;
  /** Story key → Quote id, or null while not found. */
  stories: Record<string, string | null>;
}

const FILE = 'heart-texts.yaml';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRANCH_KEY = /^branch-(\d+)$/;
export const MIZAN_MAX = 2;
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
  const unknown = Object.keys(root).find((key) => !['review', 'mizan', 'stories'].includes(key));
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

  return { review: root['review'], mizan, stories };
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
