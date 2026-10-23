import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';

/**
 * prisma/taxonomy/text-review.yaml: published texts whose stored wording may be
 * cut from a longer narration (audit B03, written by `import:book audit-texts`).
 * A reviewer marks each COMPLETE (it stands on its own) or FRAGMENT (the full
 * matn must be restored from the cited edition). Until it is COMPLETE, a listed
 * text is never chosen as the homepage reminder. Listing pages are unchanged.
 */
export type TextReviewDecision = 'COMPLETE' | 'FRAGMENT' | null;

export interface TextReviewRow {
  id: string;
  decision: TextReviewDecision;
}

const LINE = /^\s*-\s*\{\s*id:\s*([0-9a-f-]{36})\s*,.*?decision:\s*([A-Z]*)\s*\}\s*$/;

export function parseTextReview(text: string): TextReviewRow[] {
  const rows: TextReviewRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('- {')) continue;
    const match = LINE.exec(line);
    if (!match) throw new Error(`text-review.yaml: bad line ${line.trim().slice(0, 80)}`);
    const decision = match[2] || null;
    if (decision !== null && decision !== 'COMPLETE' && decision !== 'FRAGMENT') {
      throw new Error(`text-review.yaml: decision must be COMPLETE, FRAGMENT or empty, got ${decision}`);
    }
    rows.push({ id: match[1] as string, decision });
  }
  return rows;
}

let cached: string[] | null = null;

/** Ids that may not be featured: listed and not yet reviewed COMPLETE. */
export function unfeaturableTextIds(): readonly string[] {
  cached ??= parseTextReview(readTaxonomyFile('text-review.yaml'))
    .filter((row) => row.decision !== 'COMPLETE')
    .map((row) => row.id);
  return cached;
}
