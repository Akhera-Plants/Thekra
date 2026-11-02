import { readTaxonomyFile } from '../taxonomy/taxonomy-files.js';

/**
 * prisma/taxonomy/hidden-quotes.yaml: published hadith whose reader text could not be rebuilt with its
 * narrator lead (context audit 2026-11-01, rows with no automatic proposal). Owner decision 2026-11-01:
 * hidden from every public read until a reviewer writes SHOW. Nothing is written to the database; the
 * reader filters (GradePolicy.readerClause, GradePolicy.isPublishable and the shuffled-links SQL) read
 * this list.
 */
export type HiddenQuoteDecision = 'SHOW' | 'HIDE' | null;

export interface HiddenQuoteRow {
  id: string;
  reason: string;
  decision: HiddenQuoteDecision;
}

const LINE = /^\s*-\s*\{\s*id:\s*([0-9a-f-]{36})\s*,.*?reason:\s*([a-z-]+)\s*,\s*decision:\s*([A-Z]*)\s*\}\s*$/;

export function parseHiddenQuotes(text: string): HiddenQuoteRow[] {
  const rows: HiddenQuoteRow[] = [];
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('- {')) continue;
    const match = LINE.exec(line);
    if (!match) throw new Error(`hidden-quotes.yaml: bad line ${line.trim().slice(0, 80)}`);
    const [, id, reason, decision] = match as unknown as [string, string, string, string];
    if (decision !== '' && decision !== 'SHOW' && decision !== 'HIDE') {
      throw new Error(`hidden-quotes.yaml: decision must be SHOW, HIDE or empty, got ${decision}`);
    }
    if (seen.has(id)) throw new Error(`hidden-quotes.yaml: ${id} is listed twice`);
    seen.add(id);
    rows.push({ id, reason, decision: decision === '' ? null : decision });
  }
  return rows;
}

let cached: readonly string[] | null = null;
let cachedSet: ReadonlySet<string> | null = null;

/** Ids hidden from readers: listed and not reviewed SHOW. */
export function hiddenQuoteIds(): readonly string[] {
  cached ??= parseHiddenQuotes(readTaxonomyFile('hidden-quotes.yaml'))
    .filter((row) => row.decision !== 'SHOW')
    .map((row) => row.id);
  return cached;
}

export function isHiddenQuote(id: string): boolean {
  cachedSet ??= new Set(hiddenQuoteIds());
  return cachedSet.has(id);
}
