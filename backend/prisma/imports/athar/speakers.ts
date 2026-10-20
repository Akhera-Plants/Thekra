/**
 * Load backend/prisma/taxonomy/athar-speakers.yaml (flow-object lines).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AtharSpeakerEntry } from '../../../src/common/text/athar-classify.js';

const ENTRY_KEYS = new Set(['key', 'ar', 'forms']);

function unwrap(line: string): string {
  const start = line.indexOf('{');
  const end = line.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`Expected a flow object: ${line.slice(0, 80)}`);
  return line.slice(start + 1, end);
}

function parseForms(value: string): string[] {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner) return [];
  return inner.split(',').map((part) => part.trim()).filter(Boolean);
}

function parseEntry(line: string): AtharSpeakerEntry {
  const inner = unwrap(line);
  const fields: Record<string, string> = {};
  let depth = 0;
  let valueStart = -1;
  let key = '';
  const begin = (at: number) => {
    const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:/.exec(inner.slice(at));
    if (!match?.[1] || !ENTRY_KEYS.has(match[1])) {
      throw new Error(`Unknown field near "${inner.slice(at, at + 40)}"`);
    }
    key = match[1];
    valueStart = at + match[0].length;
  };
  begin(0);
  for (let index = valueStart; index <= inner.length; index += 1) {
    const ch = inner[index] ?? '';
    if (ch === '[' || ch === '{') depth += 1;
    if (ch === ']' || ch === '}') depth -= 1;
    const atEnd = index === inner.length;
    const atComma = ch === ',' && depth === 0;
    if (!atEnd && !atComma) continue;
    fields[key] = inner.slice(valueStart, index).trim();
    if (atEnd) break;
    begin(index + 1);
    index = valueStart - 1;
  }
  if (!fields.key || !fields.ar) throw new Error(`Speaker entry missing key/ar: ${line.slice(0, 80)}`);
  return {
    key: fields.key,
    ar: fields.ar,
    forms: parseForms(fields.forms ?? ''),
  };
}

export function loadAtharSpeakers(path?: string): AtharSpeakerEntry[] {
  const file =
    path ??
    resolve(dirname(fileURLToPath(import.meta.url)), '../../taxonomy/athar-speakers.yaml');
  const text = readFileSync(file, 'utf8');
  const speakers: AtharSpeakerEntry[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('- {')) continue;
    speakers.push(parseEntry(line));
  }
  return speakers;
}
