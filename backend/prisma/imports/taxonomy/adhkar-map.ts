import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFlowRow, parseTopics } from './sahihayn-map.js';
import type { Topic } from './yaml.js';

export type AdhkarMapRow = {
  id: string;
  book: 'nawawi-adhkar';
  title: string;
  topics: string[];
};

export function parseAdhkarMap(text: string): AdhkarMapRow[] {
  const rows: AdhkarMapRow[] = [];
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('- {')) continue;
    const fields = parseFlowRow(line, new Set(['id', 'book', 'title', 'topics']));
    const { id, book } = fields;
    const title = (fields.title ?? '').replace(/^"(.*)"$/, '$1');
    const topics = parseTopics(fields.topics);
    if (!id || !title || book !== 'nawawi-adhkar' || topics.length === 0) {
      throw new Error(`Invalid adhkar-map row ${id ?? ''}`);
    }
    if (seen.has(id)) throw new Error(`Duplicate adhkar-map section ${id}`);
    seen.add(id);
    rows.push({ id, book, title, topics });
  }
  if (rows.length === 0) throw new Error('adhkar-map.yaml has no sections');
  return rows;
}

export function validateAdhkarMapTopics(rows: readonly AdhkarMapRow[], topics: ReadonlyMap<string, Topic>): void {
  for (const row of rows) {
    for (const slug of row.topics) {
      const topic = topics.get(slug);
      if (!topic) throw new Error(`adhkar-map ${row.id} names unknown slug ${slug}`);
      if (topic.hidden || topic.contemporary) throw new Error(`adhkar-map ${row.id} names disallowed slug ${slug}`);
    }
  }
}

export function loadAdhkarMap(path = join(import.meta.dirname, '..', '..', 'taxonomy', 'adhkar-map.yaml')): AdhkarMapRow[] {
  return parseAdhkarMap(readFileSync(path, 'utf8'));
}
