import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml, type YamlMap } from '../practice/practice-yaml.js';

/**
 * prisma/taxonomy/reminder-sets.yaml: the starter «مجموعات التذكير» (redesign §4.6). Read only by the
 * `reminder-sets:import` command and the unit test, never by the API at runtime (the API reads the database).
 * Plain TypeScript: the import command loads this file with Node's type stripping.
 */
export interface ReminderSetSeed {
  slug: string;
  titleAr: string;
  titleEn: string;
  sortOrder: number;
  published: boolean;
  items: string[];
}

export interface ReminderSetsFile {
  review: string;
  sets: ReminderSetSeed[];
}

const FILE = 'reminder-sets.yaml';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function reminderSetsFilePath(): string {
  return join(import.meta.dirname, '..', '..', '..', 'prisma', 'taxonomy', FILE);
}

function fail(message: string): never {
  throw new Error(`${FILE}: ${message}`);
}

function isMap(value: unknown): value is YamlMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(set: YamlMap, key: string, where: string): string {
  const value = set[key];
  if (typeof value !== 'string' || value.trim() === '' || value.length > 120) fail(`${where}: ${key} must be a non-empty string of at most 120 characters`);
  return value.trim();
}

/** Validates the whole file; a bad file throws with the set and field. */
export function buildReminderSets(source: string): ReminderSetsFile {
  const root = parseYaml(source, FILE);
  if (!isMap(root)) fail('expected a mapping');
  const unknown = Object.keys(root).find((key) => !['review', 'sets'].includes(key));
  if (unknown) fail(`unknown field "${unknown}"`);
  if (typeof root['review'] !== 'string' || !root['review']) fail('review must be a non-empty string');
  const rawSets = root['sets'];
  if (!Array.isArray(rawSets) || rawSets.length === 0) fail('sets must be a non-empty list');
  const slugs = new Set<string>();
  const sets = rawSets.map((raw, index): ReminderSetSeed => {
    if (!isMap(raw)) fail(`sets[${index}] must be a mapping`);
    const extra = Object.keys(raw).find((key) => !['slug', 'titleAr', 'titleEn', 'sortOrder', 'published', 'items'].includes(key));
    if (extra) fail(`sets[${index}]: unknown field "${extra}"`);
    const slug = raw['slug'];
    if (typeof slug !== 'string' || !SLUG.test(slug) || slug.length > 80) fail(`sets[${index}]: slug must be kebab-case`);
    if (slugs.has(slug)) fail(`slug "${slug}" appears twice`);
    slugs.add(slug);
    const sortOrder = raw['sortOrder'] ?? 0;
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000) fail(`${slug}: sortOrder must be 0…1000`);
    const published = raw['published'] ?? false;
    if (typeof published !== 'boolean') fail(`${slug}: published must be true or false`);
    const items = raw['items'];
    if (!Array.isArray(items)) fail(`${slug}: items must be a list (it may be empty)`);
    const ids = items.map((id) => (typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : fail(`${slug}: ${JSON.stringify(id)} is not a UUID`)));
    if (new Set(ids).size !== ids.length) fail(`${slug} lists an id twice`);
    return { slug, titleAr: text(raw, 'titleAr', slug), titleEn: text(raw, 'titleEn', slug), sortOrder, published, items: ids };
  });
  return { review: root['review'], sets };
}

export function readReminderSets(): ReminderSetsFile {
  return buildReminderSets(readFileSync(reminderSetsFilePath(), 'utf8'));
}
