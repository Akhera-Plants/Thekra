import { parseYaml, type YamlMap } from '../practice/practice-yaml.js';
import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';

/**
 * prisma/taxonomy/home-moments.yaml: the seed of the home «في لحظات مثل هذه» list (round 6, C-09). Read by the
 * `home-moments:import` command, the unit test, and the API while the HomeMoment table is empty (the bundle embeds
 * the file: scripts/bundle.mjs, plugin `embed-taxonomy`). Plain TypeScript: the import command loads this file with
 * Node's type stripping.
 */
export type HomeMomentTopicKey = 'sin' | 'good-deed' | 'branch';

export const HOME_MOMENT_TOPICS: Record<HomeMomentTopicKey, 'SIN' | 'GOOD_DEED' | 'BRANCH'> = {
  sin: 'SIN',
  'good-deed': 'GOOD_DEED',
  branch: 'BRANCH',
};

export interface HomeMomentSeed {
  key: string;
  topicType: 'SIN' | 'GOOD_DEED' | 'BRANCH';
  topicSlug: string;
  labelAr: string;
  labelEn: string;
  situationAr: string | null;
  situationEn: string | null;
  icon: string;
  sortOrder: number;
  published: boolean;
}

const FILE = 'home-moments.yaml';
export const MOMENT_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MOMENT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MOMENT_ICON = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MOMENT_LABEL_MAX = 120;
export const MOMENT_SITUATION_MAX = 160;
const FIELDS = ['key', 'topic', 'slug', 'labelAr', 'labelEn', 'situationAr', 'situationEn', 'icon', 'sortOrder', 'published'];

function fail(message: string): never {
  throw new Error(`${FILE}: ${message}`);
}

function isMap(value: unknown): value is YamlMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(row: YamlMap, key: string, where: string, max: number, optional = false): string | null {
  const value = row[key];
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    fail(`${where}: ${key} must be a non-empty string of at most ${max} characters`);
  }
  return value.trim();
}

/** Validates the whole file; a bad file throws with the moment and field. */
export function buildHomeMoments(source: string): HomeMomentSeed[] {
  const root = parseYaml(source, FILE);
  if (!isMap(root)) fail('expected a mapping');
  const unknown = Object.keys(root).find((key) => key !== 'moments');
  if (unknown) fail(`unknown field "${unknown}"`);
  const raw = root['moments'];
  if (!Array.isArray(raw) || raw.length === 0) fail('moments must be a non-empty list');
  const keys = new Set<string>();
  return raw.map((row, index): HomeMomentSeed => {
    if (!isMap(row)) fail(`moments[${index}] must be a mapping`);
    const extra = Object.keys(row).find((field) => !FIELDS.includes(field));
    if (extra) fail(`moments[${index}]: unknown field "${extra}"`);
    const key = row['key'];
    if (typeof key !== 'string' || !MOMENT_KEY.test(key) || key.length > 40) fail(`moments[${index}]: key must be kebab-case`);
    if (keys.has(key)) fail(`key "${key}" appears twice`);
    keys.add(key);
    const topic = row['topic'];
    if (typeof topic !== 'string' || !Object.hasOwn(HOME_MOMENT_TOPICS, topic)) fail(`${key}: topic must be sin, good-deed or branch`);
    const topicType = HOME_MOMENT_TOPICS[topic as HomeMomentTopicKey];
    const slug = row['slug'];
    const slugText = typeof slug === 'number' ? String(slug) : slug;
    const slugOk = typeof slugText === 'string'
      && (topicType === 'BRANCH' ? /^[1-9][0-9]?$/.test(slugText) : MOMENT_SLUG.test(slugText) && slugText.length <= 80);
    if (!slugOk) fail(`${key}: slug must be the topic's slug (a branch number for branch)`);
    const icon = row['icon'];
    if (typeof icon !== 'string' || !MOMENT_ICON.test(icon) || icon.length > 32) fail(`${key}: icon must be a kebab-case key`);
    const sortOrder = row['sortOrder'] ?? 0;
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000) fail(`${key}: sortOrder must be 0…1000`);
    const published = row['published'] ?? true;
    if (typeof published !== 'boolean') fail(`${key}: published must be true or false`);
    return {
      key,
      topicType,
      topicSlug: slugText as string,
      labelAr: text(row, 'labelAr', key, MOMENT_LABEL_MAX)!,
      labelEn: text(row, 'labelEn', key, MOMENT_LABEL_MAX)!,
      situationAr: text(row, 'situationAr', key, MOMENT_SITUATION_MAX, true),
      situationEn: text(row, 'situationEn', key, MOMENT_SITUATION_MAX, true),
      icon,
      sortOrder,
      published,
    };
  });
}

export function readHomeMomentsSeed(): HomeMomentSeed[] {
  return buildHomeMoments(readTaxonomyFile('home-moments.yaml'));
}
