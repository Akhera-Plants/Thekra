import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The reviewer files under prisma/taxonomy/ that the API reads at runtime
 * (topic pairs, topic themes, the text review list, and the practice catalog:
 * deed schedules, sin programs and the tazkiya prompts).
 *
 * Paths come from this module's location, never process.cwd(): src/ and dist/
 * both sit one level below backend/, so ../../../prisma/taxonomy is the same
 * folder for vitest, the import scripts and `node dist/main`.
 *
 * The Vercel function ships only the bundle, so the bundle does not read these
 * from disk at all: scripts/bundle.mjs (plugin `embed-taxonomy`) replaces this
 * module with one that carries the files' text and the same exports.
 *
 * Plain TypeScript only: the import scripts load this file with Node's type
 * stripping.
 */
export const TAXONOMY_FILES = [
  'taxonomy.yaml',
  'topic-themes.yaml',
  'text-review.yaml',
  'deed-schedules.yaml',
  'sin-programs.yaml',
  'tazkiya-prompts.yaml',
] as const;
export type TaxonomyFile = (typeof TAXONOMY_FILES)[number];

export function taxonomyFilePath(file: TaxonomyFile): string {
  return join(import.meta.dirname, '..', '..', '..', 'prisma', 'taxonomy', file);
}

export function readTaxonomyFile(file: TaxonomyFile): string {
  return readFileSync(taxonomyFilePath(file), 'utf8');
}
