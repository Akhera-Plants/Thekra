/**
 * Writes src/generated/catalog.json: the habit catalog bundled into the extension as the offline fallback
 * for GET https://thekra.vercel.app/v1/practice/catalog.
 *
 * Source, in order:
 *   1. $THEKRA_SCHEDULES_YAML (a path), when set;
 *   2. ../backend/prisma/taxonomy/deed-schedules.yaml (inside the Thekra monorepo);
 *   3. the live API (after the extension moves to its own repository), when neither file exists.
 * Only `habits` are kept. Occasions are not used by the extension, and sin programs are never bundled
 * (the extension is for good deeds only, roadmap §5).
 *
 * Run: node scripts/gen-catalog.mjs   (build.mjs calls it first)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMiniYaml } from './mini-yaml.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
export const CATALOG_OUT = resolve(root, 'src/generated/catalog.json');
const MONOREPO_YAML = resolve(root, '../backend/prisma/taxonomy/deed-schedules.yaml');
const API_URL = 'https://thekra.vercel.app/v1/practice/catalog';

const HABIT_FIELDS = [
  'key', 'titleAr', 'titleEn', 'deed', 'unit', 'unitLabelAr', 'unitLabelEn', 'rakah', 'start', 'ceiling',
  'defaultRule', 'timeHintAr', 'timeHintEn', 'defaultSlots', 'basis', 'evidence',
];

/** Copies known habit fields only and checks the required ones. Throws on a malformed habit. */
export function pickHabits(raw) {
  const habits = raw && typeof raw === 'object' ? raw.habits : undefined;
  if (!Array.isArray(habits) || habits.length === 0) throw new Error('catalog: no habits found');
  return habits.map((h, i) => {
    for (const k of ['key', 'titleAr', 'titleEn', 'deed', 'unit', 'defaultRule', 'defaultSlots', 'basis', 'evidence']) {
      if (h?.[k] === undefined || h[k] === null) throw new Error(`catalog: habit #${i} (${h?.key}) is missing ${k}`);
    }
    const out = {};
    for (const k of HABIT_FIELDS) if (h[k] !== undefined && h[k] !== null) out[k] = h[k];
    return out;
  });
}

async function loadSource() {
  const fromEnv = process.env.THEKRA_SCHEDULES_YAML;
  const path = fromEnv ? resolve(fromEnv) : MONOREPO_YAML;
  if (existsSync(path)) {
    return { source: fromEnv ? path : 'backend/prisma/taxonomy/deed-schedules.yaml', raw: parseMiniYaml(readFileSync(path, 'utf8')) };
  }
  if (fromEnv) throw new Error(`THEKRA_SCHEDULES_YAML points to a missing file: ${path}`);
  const res = await fetch(API_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`catalog: ${API_URL} answered ${res.status}, and no deed-schedules.yaml was found`);
  const body = await res.json();
  return { source: API_URL, raw: body?.data };
}

export async function generateCatalog() {
  const { source, raw } = await loadSource();
  const habits = pickHabits(raw);
  mkdirSync(dirname(CATALOG_OUT), { recursive: true });
  writeFileSync(CATALOG_OUT, `${JSON.stringify({ source, habits }, null, 2)}\n`);
  return { source, count: habits.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { source, count } = await generateCatalog();
  console.log(`catalog: ${count} habits from ${source} -> src/generated/catalog.json`);
}
