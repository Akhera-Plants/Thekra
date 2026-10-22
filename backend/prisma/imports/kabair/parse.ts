/**
 * Pure parser for «الكبائر» attributed to al-Dhahabi (OpenITI
 * 0748Dhahabi.Kabair.Shamela0006848-ara1, دار الندوة الجديدة): the numbered
 * «الكبيرة <ordinal> <name>» chapter headings, and matching them to sins.
 */
import { normalizeArabic } from '../../../src/common/text/arabic-normalizer.js';
import { parseLeadingOrdinal } from '../lib/arabic-ordinal.js';
import { readBlocks } from '../lib/openiti.js';

export interface KabiraHeading {
  number: number;
  /** Sin name as printed, without «الكبيرة <ordinal>» (and a leading «في»). */
  nameAr: string;
  /** Full heading text, verbatim. */
  headingText: string;
  line: number;
}

export interface KabairParseResult {
  headings: KabiraHeading[];
  /** Numbers 1..max with no heading. */
  missingNumbers: number[];
  /** Headings whose number was already taken (first one kept). */
  duplicates: KabiraHeading[];
}

const KABIRA = 'الكبيرة';
/** A body paragraph counts as a heading only when it is a short title line. */
const MAX_PARAGRAPH_HEADING = 120;

export function parseKabair(source: string): KabairParseResult {
  const headings: KabiraHeading[] = [];
  const duplicates: KabiraHeading[] = [];
  for (const block of readBlocks(source)) {
    if (!block.text.startsWith(`${KABIRA} `)) continue;
    if (block.kind === 'paragraph' && block.text.length > MAX_PARAGRAPH_HEADING) continue;
    const afterWord = block.text.slice(KABIRA.length);
    const ordinal = parseLeadingOrdinal(afterWord);
    if (!ordinal) continue;
    const nameAr = afterWord
      .slice(ordinal.length)
      .trim()
      .replace(/^في\s+/, '');
    if (!nameAr) continue;
    const heading = { number: ordinal.value, nameAr, headingText: block.text, line: block.line };
    if (headings.some((existing) => existing.number === heading.number)) duplicates.push(heading);
    else headings.push(heading);
  }
  headings.sort((a, b) => a.number - b.number);
  const max = Math.max(0, ...headings.map((heading) => heading.number));
  const taken = new Set(headings.map((heading) => heading.number));
  const missingNumbers: number[] = [];
  for (let number = 1; number <= max; number++) if (!taken.has(number)) missingNumbers.push(number);
  return { headings, missingNumbers, duplicates };
}

// ── Matching existing sins ──────────────────────────────────────────────────

/**
 * Same sin, different word in the heading — explicit and reviewed, never fuzzy:
 * «النمام» (the tale-bearer) is the chapter on النميمة; «هجر الأقارب» is the
 * chapter on severing kinship (its body warns against «قاطع رحم»).
 */
const KABIRA_NAME_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'النميمة': ['النمام'],
  'قطع الرحم': ['هجر الأقارب'],
};

export type SinMatchKind = 'exact' | 'contains' | 'alias';

export interface SinMatch {
  status: SinMatchKind | 'ambiguous' | 'none';
  heading: KabiraHeading | null;
  candidates: KabiraHeading[];
}

function normalizeName(text: string): string {
  return normalizeArabic(text)
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Exact normalised equality wins. Otherwise the sin's name must occur as whole
 * words in exactly one heading (or be an explicit alias); two or more candidate
 * headings are ambiguous and leave the rank unset.
 */
export function matchSinToKabira(sinNameAr: string, headings: readonly KabiraHeading[]): SinMatch {
  const sin = normalizeName(sinNameAr);
  const exact = headings.filter((heading) => normalizeName(heading.nameAr) === sin);
  if (exact.length === 1) return { status: 'exact', heading: exact[0] ?? null, candidates: exact };
  if (exact.length > 1) return { status: 'ambiguous', heading: null, candidates: exact };

  const contains = headings.filter((heading) => containsWords(normalizeName(heading.nameAr), sin));
  const aliases = Object.entries(KABIRA_NAME_ALIASES)
    .filter(([name]) => normalizeName(name) === sin)
    .flatMap(([, forms]) => forms.map(normalizeName));
  const aliased = headings.filter((heading) => aliases.includes(normalizeName(heading.nameAr)));
  const candidates = [...new Set([...contains, ...aliased])];
  if (candidates.length > 1) return { status: 'ambiguous', heading: null, candidates };
  const [only] = candidates;
  if (!only) return { status: 'none', heading: null, candidates: [] };
  return { status: contains.includes(only) ? 'contains' : 'alias', heading: only, candidates };
}

export function kabiraSlug(number: number): string {
  return `kabira-${number}`;
}

export function kabiraReference(heading: KabiraHeading): string {
  return `الكبائر للذهبي، الكبيرة رقم ${heading.number} — ${heading.headingText}`;
}
