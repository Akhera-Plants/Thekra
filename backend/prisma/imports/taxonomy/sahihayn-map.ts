import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SahihaynMapRow {
  id: string;
  book: 'bukhari' | 'muslim';
  title: string;
  topics: string[];
}

const ROW_KEYS = new Set(['id', 'book', 'title', 'topics']);

function unwrap(line: string): string {
  const start = line.indexOf('{');
  const end = line.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`Expected a flow object: ${line.slice(0, 80)}`);
  return line.slice(start + 1, end);
}

function parseFlow(inner: string, keys: Set<string>): Record<string, string> {
  const hits: { key: string; valueStart: number; valueEnd: number }[] = [];
  let depth = 0;
  let valueStart = -1;
  let key = '';
  const begin = (at: number) => {
    const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:/.exec(inner.slice(at));
    if (!match?.[1] || !keys.has(match[1])) {
      throw new Error(`Unknown field near "${inner.slice(at, at + 40)}"`);
    }
    key = match[1];
    valueStart = at + match[0].length;
  };
  begin(0);
  for (let index = valueStart; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === '[') depth += 1;
    else if (char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:/.exec(inner.slice(index + 1));
      if (match?.[1] && keys.has(match[1])) {
        hits.push({ key, valueStart, valueEnd: index });
        begin(index + 1);
        index = valueStart - 1;
      }
    }
  }
  hits.push({ key, valueStart, valueEnd: inner.length });
  return Object.fromEntries(hits.map((hit) => [hit.key, inner.slice(hit.valueStart, hit.valueEnd).trim()]));
}

function parseTopics(value: string | undefined): string[] {
  if (!value) return [];
  const match = /^\[(.*)\]$/.exec(value);
  if (!match) throw new Error(`Expected a topics list, got ${value}`);
  const body = match[1] ?? '';
  if (!body.trim()) return [];
  return body.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}

export function parseSahihaynMap(text: string): SahihaynMapRow[] {
  const rows: SahihaynMapRow[] = [];
  let inSections = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('sections:')) {
      inSections = true;
      continue;
    }
    if (!inSections || !trimmed.startsWith('- {')) continue;
    const fields = parseFlow(unwrap(line), ROW_KEYS);
    const book = fields['book'];
    if (book !== 'bukhari' && book !== 'muslim') {
      throw new Error(`Sahihayn map row ${fields['id']} has bad book ${book}`);
    }
    const topics = parseTopics(fields['topics']);
    if (topics.length === 0) throw new Error(`Sahihayn map row ${fields['id']} has no topics`);
    const id = fields['id'];
    const title = fields['title'];
    if (!id || !title) throw new Error('Sahihayn map row missing id or title');
    rows.push({ id, book, title, topics });
  }
  if (rows.length === 0) throw new Error('sahihayn-map.yaml has no sections');
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`Duplicate sahihayn-map section ${row.id}`);
    seen.add(row.id);
  }
  return rows;
}

export function loadSahihaynMap(path = join(import.meta.dirname, '..', '..', 'taxonomy', 'sahihayn-map.yaml')): SahihaynMapRow[] {
  return parseSahihaynMap(readFileSync(path, 'utf8'));
}
