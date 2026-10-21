import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HadeethencMapRow {
  /** HadeethEnc external id (Quote.apiProvider = hadeethenc.com, Quote.externalId). */
  id: string;
  title: string;
  topics: string[];
  confidence: 'high' | 'low';
  reason: string;
}

const HEADER = 'id\ttitle\ttopics\tconfidence\treason';

export function parseHadeethencMap(text: string): HadeethencMapRow[] {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== HEADER) {
    throw new Error(`hadeethenc-map.tsv has an unexpected header: ${lines[0]?.slice(0, 60)}`);
  }
  const rows: HadeethencMapRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [id, title, topics, confidence, reason] = line.split('\t');
    if (!id || !/^\d+$/.test(id)) throw new Error(`hadeethenc-map row has bad id ${id}`);
    if (confidence !== 'high' && confidence !== 'low') {
      throw new Error(`hadeethenc-map row ${id} has bad confidence ${confidence}`);
    }
    rows.push({
      id,
      title: title ?? '',
      topics: (topics ?? '').split(',').map((slug) => slug.trim()).filter((slug) => slug.length > 0),
      confidence,
      reason: (reason ?? '').trim(),
    });
  }
  if (rows.length === 0) throw new Error('hadeethenc-map.tsv has no rows');
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`Duplicate hadeethenc-map id ${row.id}`);
    seen.add(row.id);
  }
  return rows;
}

/** Only high-confidence rows with at least one topic produce links. */
export function highConfidenceRows(rows: readonly HadeethencMapRow[]): HadeethencMapRow[] {
  return rows.filter((row) => row.confidence === 'high' && row.topics.length > 0);
}

/** Every slug on an applied (high-confidence) row must exist in taxonomy.yaml. */
export function validateHadeethencMapTopics(rows: readonly HadeethencMapRow[], topics: ReadonlyMap<string, unknown>): void {
  for (const row of highConfidenceRows(rows)) {
    for (const slug of row.topics) {
      if (!topics.has(slug)) throw new Error(`hadeethenc-map ${row.id} names unknown slug ${slug}`);
    }
  }
}

export function loadHadeethencMap(path = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'taxonomy', 'hadeethenc-map.tsv')): HadeethencMapRow[] {
  return parseHadeethencMap(readFileSync(path, 'utf8'));
}
