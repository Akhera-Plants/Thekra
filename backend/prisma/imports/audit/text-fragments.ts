/**
 * Read-only audit (B03): published hadith whose stored wording may be cut from
 * a longer narration. Writes prisma/taxonomy/text-review.yaml for a reviewer;
 * the database is not changed, and decisions already in the file are kept.
 *
 *   pnpm --filter backend import:book audit-texts
 *
 * A text is listed when
 *   - fragment: most of its words sit inside the cited edition entry, which is
 *     at least four times longer (after allowing for the chain), or
 *   - short: fewer than six words.
 * Both are signals for review, not proof: «كل معروف صدقة» is short and whole.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { QuoteType } from '@prisma/client';
import { GradePolicy } from '../../../src/modules/hadith/grade-policy.js';
import { parseTextReview, type TextReviewDecision } from '../../../src/modules/quotes/text-review.js';
import { taxonomyFilePath } from '../../../src/modules/taxonomy/taxonomy-files.js';
import type { ImportOptions } from '../lib/cli.js';
import { citedEditions, type EnglishBook } from '../translations/citation.js';
import { editionRows, ensureFile } from '../translations/editions.js';
import { ARABIC_EDITIONS, ENGLISH_EDITIONS, hadithEditionUrl } from '../translations/files.js';
import { arabicWords } from '../translations/match.js';

export type FragmentReason = 'fragment' | 'short';

const MIN_WORDS = 6;
/** Share of the stored words that must sit inside the edition entry. */
const INSIDE = 0.8;
/** Stored length over the entry's matn length (the chain is taken as 40% of the entry). */
const FRAGMENT_RATIO = 0.25;

/** Why a stored text may be a fragment of one of the edition entries (their distinct words), or null. */
export function fragmentReason(stored: string, entries: readonly string[][]): FragmentReason | null {
  const words = [...arabicWords(stored)];
  if (words.length === 0) return null;
  if (words.length < MIN_WORDS) return 'short';
  for (const entry of entries) {
    const set = new Set(entry);
    const inside = words.filter((word) => set.has(word)).length / words.length;
    if (inside >= INSIDE && words.length / Math.max(entry.length * 0.6, 1) < FRAGMENT_RATIO) return 'fragment';
  }
  return null;
}

function yamlString(value: string): string {
  return JSON.stringify(value.replace(/\s+/g, ' ').trim());
}

export async function runTextAudit(options: ImportOptions): Promise<void> {
  // Arabic words of every edition entry, by book and printed number.
  const entries = new Map<EnglishBook, Map<number, string[][]>>();
  for (const edition of ENGLISH_EDITIONS) {
    const arabicFile = ARABIC_EDITIONS.find((row) => row.book === edition.book);
    if (!arabicFile) throw new Error(`No Arabic edition for ${edition.book}`);
    const english = editionRows(await ensureFile(edition.file, edition.sha256, hadithEditionUrl(edition.file)));
    const arabic = new Map(
      editionRows(await ensureFile(arabicFile.file, arabicFile.sha256, hadithEditionUrl(arabicFile.file)))
        .map((row) => [Number(row.hadithnumber), row.text ?? '']),
    );
    const byNumber = new Map<number, string[][]>();
    for (const row of english) {
      if (row.arabicnumber === undefined || row.arabicnumber === '') continue;
      const number = Math.trunc(Number(row.arabicnumber));
      const text = arabic.get(Number(row.hadithnumber)) ?? '';
      byNumber.set(number, [...(byNumber.get(number) ?? []), [...arabicWords(text)]]);
    }
    entries.set(edition.book, byNumber);
  }

  const rows = await options.prisma.quote.findMany({
    where: { AND: [{ type: QuoteType.HADITH }, GradePolicy.readerClause()] },
    select: { id: true, textAr: true, matnAr: true, gradeReference: true },
    orderBy: { id: 'asc' },
  });

  const path = taxonomyFilePath('text-review.yaml');
  const previous = new Map<string, TextReviewDecision>(
    existsSync(path) ? parseTextReview(readFileSync(path, 'utf8')).map((row) => [row.id, row.decision]) : [],
  );

  const listed: string[] = [];
  const counts = { fragment: 0, short: 0 };
  for (const row of rows) {
    const stored = row.matnAr || row.textAr;
    const candidates = citedEditions(row.gradeReference).flatMap(
      (cite) => entries.get(cite.book)?.get(cite.number) ?? [],
    );
    const reason = fragmentReason(stored, candidates);
    if (!reason) continue;
    counts[reason] += 1;
    const decision = previous.get(row.id) ?? '';
    listed.push(
      `  # ${yamlString(stored.slice(0, 120))}\n` +
        `  - { id: ${row.id}, ref: ${yamlString(row.gradeReference ?? '')}, reason: ${reason}, decision: ${decision} }`,
    );
  }

  const header = [
    '# Published hadith whose stored wording may be cut from a longer narration (audit B03).',
    '# Written by `pnpm --filter backend import:book audit-texts` (read-only on the database);',
    '# a re-run keeps the decisions below.',
    '#',
    '# decision: COMPLETE  the text stands on its own as stored',
    '#           FRAGMENT  the full matn must be restored from the cited edition (reviewed migration)',
    '#           (empty)   not reviewed yet',
    '# Until a text is COMPLETE it is never chosen as the homepage reminder. Listing pages are unchanged.',
    'texts:',
  ];
  const text = `${header.join('\n')}\n${listed.join('\n')}\n`;
  console.log(JSON.stringify({ published: rows.length, listed: listed.length, ...counts, dryRun: options.dryRun }));
  if (!options.dryRun) writeFileSync(path, text);
}
