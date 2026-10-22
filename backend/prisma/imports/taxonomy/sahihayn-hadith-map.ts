import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type SahihaynHadithTarget = { kind: 'topic'; slug: string } | { kind: 'branch'; number: number };
export type SahihaynHadithRow = {
  quoteId: string;
  book: 'BUKHARI' | 'MUSLIM';
  number: number;
  bab: string;
  targets: SahihaynHadithTarget[];
};

/** Only high-confidence decisions are executable; blank/low rows create no links. */
export function parseSahihaynHadithMap(text: string): SahihaynHadithRow[] {
  const lines = text.trimEnd().split(/\r?\n/);
  if (lines.shift() !== 'quoteId\tbook\tnumber\tbab\ttargets\tconfidence\treason') {
    throw new Error('Invalid sahihayn-hadith-map header');
  }
  const rows: SahihaynHadithRow[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const [quoteId, book, numberText, bab, targetText, confidence] = line.split('\t');
    if (confidence !== 'high') continue;
    const number = Number(numberText);
    if (!quoteId || !bab || (book !== 'BUKHARI' && book !== 'MUSLIM') || !Number.isInteger(number) || number < 1 || !targetText) {
      throw new Error(`Invalid sahihayn-hadith-map row ${quoteId ?? ''}`);
    }
    if (seen.has(quoteId)) throw new Error(`Duplicate sahihayn-hadith-map quote ${quoteId}`);
    seen.add(quoteId);
    const targets = targetText.split(',').map((raw): SahihaynHadithTarget => {
      const target = raw.trim();
      if (/^topic:[a-z0-9-]+$/.test(target)) return { kind: 'topic', slug: target.slice(6) };
      if (/^branch:[1-9]\d*$/.test(target)) return { kind: 'branch', number: Number(target.slice(7)) };
      throw new Error(`Invalid sahihayn-hadith-map target ${target}`);
    });
    rows.push({ quoteId, book, number, bab, targets });
  }
  return rows;
}

export function validateSahihaynHadithMap(rows: readonly SahihaynHadithRow[], topics: ReadonlyMap<string, unknown>, branches: ReadonlySet<number>): void {
  for (const row of rows) {
    for (const target of row.targets) {
      if (target.kind === 'topic' && !topics.has(target.slug)) throw new Error(`Unknown slug ${target.slug} on ${row.quoteId}`);
      if (target.kind === 'branch' && !branches.has(target.number)) throw new Error(`Unknown branch ${target.number} on ${row.quoteId}`);
    }
  }
}

export function sahihaynHadithNote(row: SahihaynHadithRow): string {
  return `تصنيف المراجع — ${row.book === 'BUKHARI' ? 'صحيح البخاري' : 'صحيح مسلم'}، باب: ${row.bab}`;
}

export function loadSahihaynHadithMap(path = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'taxonomy', 'sahihayn-hadith-map.tsv')): SahihaynHadithRow[] {
  return parseSahihaynHadithMap(readFileSync(path, 'utf8'));
}
