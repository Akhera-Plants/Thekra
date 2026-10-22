import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFlowRow, parseTopics } from './sahihayn-map.js';

export interface DunyaMapRow {
  id: string;
  book: 'ibn-abi-dunya';
  /** OpenITI work key (e.g. Ciyal); the Source apiProvider is book:ibn-abi-dunya:<key lowercase>. */
  work: string;
  title: string;
  topics: string[];
}

const ROW_KEYS = new Set(['id', 'book', 'work', 'title', 'topics']);

function unquote(value: string): string {
  const match = /^"(.*)"$/.exec(value);
  return match ? (match[1] ?? '') : value;
}

export function parseDunyaMap(text: string): DunyaMapRow[] {
  const rows: DunyaMapRow[] = [];
  let inSections = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('sections:')) {
      inSections = true;
      continue;
    }
    if (!inSections || !trimmed.startsWith('- {')) continue;
    const fields = parseFlowRow(line, ROW_KEYS);
    const book = fields['book'];
    if (book !== 'ibn-abi-dunya') {
      throw new Error(`ibn-abi-dunya-map row ${fields['id']} has bad book ${book}`);
    }
    const topics = parseTopics(fields['topics']);
    if (topics.length === 0) throw new Error(`ibn-abi-dunya-map row ${fields['id']} has no topics`);
    const id = fields['id'];
    const work = fields['work'];
    const title = unquote(fields['title'] ?? '');
    if (!id || !work || !title) throw new Error('ibn-abi-dunya-map row missing id, work, or title');
    rows.push({ id, book, work, title, topics });
  }
  if (rows.length === 0) throw new Error('ibn-abi-dunya-map.yaml has no sections');
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`Duplicate ibn-abi-dunya-map section ${row.id}`);
    seen.add(row.id);
  }
  return rows;
}

/** Every listed topic slug must exist in taxonomy.yaml. */
export function validateDunyaMapTopics(rows: readonly DunyaMapRow[], topics: ReadonlyMap<string, unknown>): void {
  for (const row of rows) {
    for (const slug of row.topics) {
      if (!topics.has(slug)) throw new Error(`ibn-abi-dunya-map ${row.id} names unknown slug ${slug}`);
    }
  }
}

export function loadDunyaMap(path = join(import.meta.dirname, '..', '..', 'taxonomy', 'ibn-abi-dunya-map.yaml')): DunyaMapRow[] {
  return parseDunyaMap(readFileSync(path, 'utf8'));
}
