/**
 * Pinned OpenITI edition for al-Adhkar (0700AH / 0676Nawawi.Adhkar).
 *
 * Shamela0001956-ara1 — the Dar al-Fikr print edited by ʿAbd al-Qadir
 * al-Arna'ut — was chosen after inspecting all Sunni editions in the folder:
 * it is the only one with clean `### |` kitab/bab headings (18 كتاب, 335 باب)
 * AND per-narration `### | N - ` numbering (1251 numbered narrations).
 * Shamela0010639 has blank `كتاب ` headings, Sham19Y0013566 only machine
 * `AUTO` headings, JK001249 no structural headings at all. Shia002207-ara1 is
 * excluded by policy and never used.
 *
 * SHA-256 is verified by loadCorpus on every run.
 */
import type { CorpusSpec } from '../lib/corpus.js';

export const ADHKAR_KEY = 'adhkar';
/** Stable Source.id — next free slot in the approved-works UUID range. */
export const ADHKAR_SOURCE_ID = '10000000-0000-4000-8000-000000000027';
export const ADHKAR_PROVIDER = 'book:nawawi-adhkar';
export const ADHKAR_TITLE_AR = 'الأذكار';

export const ADHKAR_CORPUS: CorpusSpec = {
  repo: '0700AH',
  path: 'data/0676Nawawi/0676Nawawi.Adhkar/0676Nawawi.Adhkar.Shamela0001956-ara1',
  commit: '3d8ff4e7b035aaa4ca5dda52c7322645f3401dcf',
  sha256: 'dc4947906c9bce1834eeec51f5c0c1e3f0aaf09b7e918628c87e849a97112845',
};
